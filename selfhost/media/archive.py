#!/usr/bin/env python3
"""Resumable public-media archive. Python 3 standard library; never serves downloaded files."""
import argparse
import csv
import errno
import fcntl
import gzip
import hashlib
import http.client
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import sqlite3
import ssl
import sys
import time
from urllib.parse import parse_qsl, quote, urlencode, urljoin, urlsplit, urlunsplit

SCHEMA = '''
CREATE TABLE IF NOT EXISTS assets (
 id INTEGER PRIMARY KEY, url TEXT UNIQUE NOT NULL, type TEXT NOT NULL,
 expected INTEGER, status TEXT NOT NULL DEFAULT 'pending', tries INTEGER NOT NULL DEFAULT 0,
 actual_type TEXT, bytes INTEGER, sha256 TEXT, path TEXT, error TEXT, http_status INTEGER,
 final_url TEXT, completed_at TEXT, phase INTEGER, rank INTEGER);
CREATE INDEX IF NOT EXISTS asset_types ON assets(type);
CREATE INDEX IF NOT EXISTS queue ON assets(status,phase,rank,expected,id);
CREATE TABLE IF NOT EXISTS blobs (sha256 TEXT PRIMARY KEY, bytes INTEGER NOT NULL, path TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
'''


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def media_type(value):
    return (value or '').split(';', 1)[0].strip().lower() or 'unspecified'


def type_dir(value):
    return re.sub('[^a-z0-9.-]+', '-', media_type(value)).strip('.-') or 'unspecified'


def public_target(url):
    p = urlsplit(url)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
        raise ValueError('Unsupported or credential-bearing URL')
    if any(ord(c) < 32 for c in url) or '\\' in p.netloc:
        raise ValueError('Invalid URL')
    port = p.port or (443 if p.scheme == 'https' else 80)
    if port not in (80, 443):
        raise ValueError('Nonstandard source port')
    host = p.hostname.encode('idna').decode('ascii')
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not addresses or any((not ipaddress.ip_address(a[4][0]).is_global or ipaddress.ip_address(a[4][0]).is_multicast or ipaddress.ip_address(a[4][0]).is_reserved) for a in addresses):
        raise ValueError('Source must resolve only to public addresses')
    # Connect to this exact validated address; TLS still checks the original hostname.
    return p, host, port, addresses[0][4][0]


class PublicHTTP(http.client.HTTPConnection):
    def __init__(self, host, port, address, secure):
        super().__init__(host, port, timeout=25)
        self.address, self.secure = address, secure

    def connect(self):
        self.sock = socket.create_connection((self.address, self.port), self.timeout)
        if self.secure:
            self.sock = ssl.create_default_context().wrap_socket(self.sock, server_hostname=self.host)


def open_source(url, headers=None):
    p = urlsplit(url)
    if p.hostname in ('www.dropbox.com', 'dropbox.com') and p.path.startswith(('/s/', '/scl/fi/')):
        query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in ('dl', 'raw')]
        url = urlunsplit((p.scheme, p.netloc, p.path, urlencode(query + [('dl', '1')]), ''))
    for _ in range(6):
        p, host, port, address = public_target(url)
        conn = PublicHTTP(host, port, address, p.scheme == 'https')
        target = quote(p.path or '/', safe="/%:@!$&'()*+,;=-._~")
        if p.query:
            target += '?' + quote(p.query, safe="%/:?@!$&'()*+,;=-._~")
        try:
            conn.request('GET', target, headers={
                'User-Agent': 'VoxelsPublicArchive/1.0', 'Accept-Encoding': 'identity',
                'Accept': '*/*', **(headers or {}),
            })
            response = conn.getresponse()
        except Exception:
            conn.close()
            raise
        if response.status not in (301, 302, 303, 307, 308):
            return conn, response, url
        location = response.getheader('Location')
        response.close()
        conn.close()
        if not location:
            raise ValueError('Redirect missing Location')
        url = urljoin(url, location)
    raise ValueError('Too many redirects')


class StorageFull(Exception):
    pass


class Unavailable(Exception):
    def __init__(self, reason, status=None, retry=False):
        super().__init__(reason)
        self.status, self.retry = status, retry


class Archive:
    def __init__(self, args):
        self.args = args
        self.root, self.state = Path(args.root).resolve(), Path(args.state).resolve()
        self.state.mkdir(parents=True, exist_ok=True)
        self.lock = (self.state / 'run.lock').open('a')
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.lock.close()
            raise
        self.db = sqlite3.connect(self.state / 'catalog.sqlite')
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.stopping = False
        self.last_status = self.last_snapshot = 0
        self.current = None
        self.used = self.db.execute('SELECT COALESCE(SUM(bytes),0) FROM blobs').fetchone()[0]

    def check_mount(self):
        if self.args.mount and not os.path.ismount(self.args.mount):
            raise StorageFull('Archive mount unavailable; refusing local fallback')
        if self.args.mount and not self.root.is_relative_to(Path(self.args.mount).resolve()):
            raise StorageFull('Media directory must be inside the archive mount')
        if self.args.mount and self.root.exists() and os.stat(self.root).st_dev != os.stat(self.args.mount).st_dev:
            raise StorageFull('Media directory is not on the archive filesystem')
        if self.args.mount and os.stat(self.args.mount).st_dev == os.stat(self.state).st_dev:
            raise StorageFull('Archive mount and local state must be on different filesystems')
        if self.root.exists() and shutil.disk_usage(self.root).free < self.args.free_bytes:
            raise StorageFull('Storage free-space headroom reached')

    def import_csv(self, source):
        if self.db.execute('SELECT COUNT(*) FROM assets').fetchone()[0]:
            raise ValueError('Catalog already initialized; use run to resume')
        h = hashlib.sha256()
        with open(source, 'rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
        opener = gzip.open if str(source).endswith('.gz') else open
        with opener(source, 'rt', newline='', encoding='utf-8-sig') as f, self.db:
            for row in csv.DictReader(f):
                if row.get('category', 'asset') != 'asset':
                    continue
                url = row['url']
                if url.startswith("'http"):
                    url = url[1:]  # Inventory spreadsheet escaping, not part of the URL.
                size = int(row['bytes']) if row.get('bytes', '').isdigit() else None
                self.db.execute('INSERT OR IGNORE INTO assets(url,type,expected) VALUES(?,?,?)',
                                (url, media_type(row.get('content_type')), size))
            groups = self.db.execute('SELECT type,SUM(expected) total FROM assets GROUP BY type ORDER BY total IS NULL,total,type').fetchall()
            for rank, row in enumerate(groups):
                self.db.execute('UPDATE assets SET rank=?,phase=CASE WHEN expected IS NULL THEN 1 ELSE 0 END WHERE type=?', (rank, row['type']))
            self.db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('source_sha256', h.hexdigest()))
            self.db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('imported_at', now()))
        print(json.dumps({'imported': self.db.execute('SELECT COUNT(*) FROM assets').fetchone()[0], 'source_sha256': h.hexdigest()}))

    def snapshot(self):
        # SQLite writes stay on local disk. Only closed, consistent snapshots cross SFTP/FUSE.
        local = self.state / 'catalog.snapshot.sqlite'
        with sqlite3.connect(local) as target:
            self.db.backup(target)
        temp = self.root / 'catalog.sqlite.pending'
        shutil.copyfile(local, temp)
        os.replace(temp, self.root / 'catalog.sqlite')
        local.unlink()
        self.last_snapshot = time.monotonic()

    def report(self, state='running', force=False, error=None):
        if not force and time.monotonic() - self.last_status < 30:
            return
        counts = dict(self.db.execute('SELECT status,COUNT(*) FROM assets GROUP BY status'))
        groups = [dict(r) for r in self.db.execute('''SELECT type,COUNT(*) urls,SUM(expected) reported_bytes,
          SUM(status='done') downloaded,SUM(status='failed') failed,SUM(status='skipped') skipped,
          SUM(CASE WHEN status='done' THEN bytes ELSE 0 END) downloaded_url_bytes
          FROM assets GROUP BY type ORDER BY MIN(rank)''')]
        value = {'updated_at': now(), 'state': state, 'counts': counts, 'unique_bytes': self.used,
                 'unique_files': self.db.execute('SELECT COUNT(*) FROM blobs').fetchone()[0],
                 'duplicate_urls': counts.get('done', 0) - self.db.execute('SELECT COUNT(*) FROM blobs').fetchone()[0],
                 'limit_bytes': self.args.max_bytes, 'current': self.current, 'groups': groups, 'error': error,
                 'source_sha256': self.db.execute("SELECT value FROM meta WHERE key='source_sha256'").fetchone()[0]}
        for folder in (self.state, self.root):
            try:
                if folder == self.root:
                    self.check_mount()
                tmp = folder / 'status.json.pending'
                tmp.write_text(json.dumps(value, indent=2) + '\n')
                os.replace(tmp, folder / 'status.json')
            except (OSError, StorageFull):
                if folder == self.state:
                    raise
        print(json.dumps({k: value[k] for k in ['updated_at', 'state', 'counts', 'unique_bytes', 'current', 'error']}), flush=True)
        self.last_status = time.monotonic()
        if state in ('complete', 'blocked', 'stopped') or time.monotonic() - self.last_snapshot > 900:
            try:
                self.check_mount()
                self.snapshot()
                lines = ['# Public media archive report', '', 'Updated: ' + now(), '', 'State: ' + state,
                         '', f'Unique files: {value["unique_files"]:,}; unique bytes: {self.used:,}.',
                         f'URL outcomes: {json.dumps(counts)}.', '',
                         'Original URLs and full outcomes are in catalog.sqlite. Files are inert archive data, not executable web content.', '',
                         '| Reported type | URLs | Downloaded | Failed | Skipped | Downloaded URL bytes |',
                         '| --- | ---: | ---: | ---: | ---: | ---: |']
                for g in groups:
                    lines.append('| ' + ' | '.join(str(g[k]).replace('|', '/') for k in ['type', 'urls', 'downloaded', 'failed', 'skipped', 'downloaded_url_bytes']) + ' |')
                (self.root / 'REPORT.md').write_text('\n'.join(lines) + '\n')
                (self.state / 'REPORT.md').write_text('\n'.join(lines) + '\n')
                if state == 'complete':
                    with (self.root / 'unavailable.csv').open('w', newline='') as f:
                        writer = csv.writer(f)
                        writer.writerow(['url', 'type', 'status', 'http_status', 'tries', 'error'])
                        writer.writerows(self.db.execute("SELECT url,type,status,http_status,tries,error FROM assets WHERE status IN ('failed','skipped') ORDER BY id"))
            except (OSError, StorageFull) as exc:
                print('Snapshot deferred: ' + str(exc), flush=True)

    def finish(self, row, status, **fields):
        fields.update(status=status, completed_at=now())
        with self.db:
            self.db.execute('UPDATE assets SET ' + ','.join(k + '=?' for k in fields) + ' WHERE id=?', (*fields.values(), row['id']))

    def download(self, row):
        self.check_mount()
        part = self.root / '.partial' / (hashlib.sha256(row['url'].encode()).hexdigest() + '.part')
        meta = part.with_suffix('.json')
        saved = json.loads(meta.read_text()) if meta.exists() else {}
        offset = part.stat().st_size if part.exists() else 0
        validator = saved.get('validator')
        if not validator:
            offset = 0
        headers = {'Range': f'bytes={offset}-', 'If-Range': validator} if offset else {}
        conn, response, final_url = open_source(row['url'], headers)
        try:
            code = response.status
            if code == 416 and offset:
                part.unlink(missing_ok=True)
                meta.unlink(missing_ok=True)
                raise Unavailable('Range no longer available; restart from source', code, True)
            if code not in (200, 206):
                raise Unavailable('HTTP ' + str(code), code, code == 429 or code >= 500)
            kind = media_type(response.getheader('Content-Type'))
            cache_control = response.getheader('Cache-Control', '').lower()
            if 'private' in cache_control or kind in ('text/html', 'text/html,text/html', 'application/xhtml+xml'):
                raise Unavailable('Private or HTML response is not archived', code)
            if response.getheader('Content-Encoding', 'identity').lower() not in ('', 'identity'):
                raise Unavailable('Source ignored identity encoding', code)
            length = response.getheader('Content-Length')
            length = int(length) if length and length.isdigit() else None
            if code == 206:
                match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.getheader('Content-Range', ''))
                if not offset or not match or int(match[1]) != offset or int(match[2]) + 1 != int(match[3]):
                    raise Unavailable('Unexpected partial response', code)
                total = int(match[3])
                if length is not None and length != total - offset:
                    raise Unavailable('Inconsistent partial length', code)
            else:
                offset, total = 0, length
            if total is not None and total > self.args.max_file_bytes:
                raise Unavailable('File exceeds configured maximum', code)
            if total is not None and self.used + total > self.args.max_bytes:
                raise StorageFull('Archive byte budget reached')
            etag = response.getheader('ETag')
            validator = etag if etag and not etag.startswith('W/') else response.getheader('Last-Modified')
            meta.write_text(json.dumps({'validator': validator, 'url': row['url'], 'final_url': final_url}))
            digest = hashlib.sha256()
            if offset:
                with part.open('rb') as f:
                    for block in iter(lambda: f.read(1024 * 1024), b''):
                        digest.update(block)
            size = offset
            started = time.monotonic()
            last_space_check = started
            self.current = {'id': row['id'], 'type': row['type'], 'host': urlsplit(final_url).hostname, 'bytes': size, 'expected_bytes': total}
            with part.open('ab' if offset else 'wb') as f:
                while True:
                    if self.stopping:
                        raise InterruptedError('Stopping; partial retained for resume')
                    data = response.read(256 * 1024)
                    if not data:
                        break
                    size += len(data)
                    if size > self.args.max_file_bytes:
                        raise Unavailable('File exceeds configured maximum', code)
                    if self.used + size > self.args.max_bytes:
                        raise StorageFull('Archive byte budget reached')
                    if time.monotonic() - last_space_check > 10:
                        self.check_mount()
                        last_space_check = time.monotonic()
                    f.write(data)
                    digest.update(data)
                    self.current['bytes'] = size
                    self.report()
                    delay = (size - offset) / self.args.rate - (time.monotonic() - started)
                    if delay > 0:
                        time.sleep(min(delay, 2))
                    if time.monotonic() - started > 24 * 3600:
                        raise Unavailable('Download time limit reached', code)
            if total is not None and size != total:
                raise Unavailable('Truncated response', code, True)
            sha = digest.hexdigest()
            existing = self.db.execute('SELECT * FROM blobs WHERE sha256=?', (sha,)).fetchone()
            extension = mimetypes.guess_extension(kind) or '.bin'
            rel = existing['path'] if existing else f'files/{type_dir(kind)}/{sha[:2]}/{sha}{extension}'
            target = self.root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.stat().st_size != size:
                os.replace(part, target)
            else:
                part.unlink()
            meta.unlink(missing_ok=True)
            with self.db:
                self.db.execute('INSERT OR IGNORE INTO blobs VALUES(?,?,?)', (sha, size, rel))
            if not existing:
                self.used += size
            self.finish(row, 'done', bytes=size, sha256=sha, path=rel, actual_type=kind, final_url=final_url, http_status=code, error=None)
        finally:
            response.close()
            conn.close()

    def run(self):
        self.check_mount()
        (self.root / '.partial').mkdir(parents=True, exist_ok=True)
        with self.db:
            self.db.execute("UPDATE assets SET status='pending' WHERE status='downloading'")
        self.report(force=True)
        while not self.stopping:
            row = self.db.execute("SELECT * FROM assets WHERE status='pending' ORDER BY phase,rank,expected,id LIMIT 1").fetchone()
            if row is None:
                self.current = None
                self.report('complete', True)
                return 0
            with self.db:
                self.db.execute("UPDATE assets SET status='downloading',tries=tries+1 WHERE id=?", (row['id'],))
            try:
                self.download(row)
            except InterruptedError:
                with self.db:
                    self.db.execute("UPDATE assets SET status='pending' WHERE id=?", (row['id'],))
                break
            except (StorageFull, OSError) as exc:
                if isinstance(exc, StorageFull) or getattr(exc, 'errno', None) in (errno.ENOSPC, errno.EDQUOT, errno.EIO, errno.EROFS, errno.ENOTCONN):
                    with self.db:
                        self.db.execute("UPDATE assets SET status='pending',error=? WHERE id=?", (str(exc), row['id']))
                    self.report('blocked', True, str(exc))
                    return 75
                self.failed(row, exc, True)
            except Unavailable as exc:
                self.failed(row, exc, exc.retry)
            except (ValueError, http.client.HTTPException) as exc:
                self.failed(row, exc, isinstance(exc, http.client.HTTPException))
            self.current = None
            self.report()
        self.report('stopped', True)
        return 0

    def failed(self, row, exc, retry):
        status = 'pending' if retry and row['tries'] + 1 < 3 else ('failed' if retry else 'skipped')
        self.finish(row, status, error=str(exc)[:500], http_status=getattr(exc, 'status', None))
        if status == 'pending':
            time.sleep(30 if getattr(exc, 'status', None) == 429 else 2 * (row['tries'] + 1))
        else:
            part = self.root / '.partial' / (hashlib.sha256(row['url'].encode()).hexdigest() + '.part')
            part.unlink(missing_ok=True)
            part.with_suffix('.json').unlink(missing_ok=True)


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['import', 'run', 'status'])
    p.add_argument('--root', required=True, help='Media directory on archive storage')
    p.add_argument('--state', required=True, help='Local state directory (not on SFTP/NFS)')
    p.add_argument('--csv', help='Public inventory assets.csv, for import')
    p.add_argument('--mount', help='Require this separate storage mount before writing')
    p.add_argument('--max-bytes', type=int, default=1_350_000_000_000)
    p.add_argument('--max-file-bytes', type=int, default=50_000_000_000)
    p.add_argument('--free-bytes', type=int, default=10_000_000_000)
    p.add_argument('--rate', type=int, default=8_000_000, help='Maximum payload bytes/second')
    return p


def main():
    args = parser().parse_args()
    if args.command == 'status':
        print((Path(args.state) / 'status.json').read_text())
        return 0
    if min(args.max_bytes, args.max_file_bytes, args.free_bytes, args.rate) <= 0:
        raise ValueError('Limits must be positive')
    archive = Archive(args)
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: setattr(archive, 'stopping', True))
    if args.command == 'import':
        archive.import_csv(args.csv)
        return 0
    return archive.run()


if __name__ == '__main__':
    sys.exit(main())
