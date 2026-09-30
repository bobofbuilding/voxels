import argparse
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('archive', Path(__file__).with_name('archive.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


class Response(io.BytesIO):
    def __init__(self, data, status=200, headers=None):
        super().__init__(data)
        self.status = status
        self.headers = {'Content-Type': 'image/png', 'Content-Length': str(len(data)), 'ETag': '"v1"', **(headers or {})}

    def getheader(self, key, default=None):
        return self.headers.get(key, default)


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        base = Path(self.temp.name)
        self.root = base / 'media'
        self.root.mkdir()
        self.args = argparse.Namespace(root=str(self.root), state=str(base / 'state'), mount=None,
                                       max_bytes=10000, max_file_bytes=9000, free_bytes=1, rate=10**9)
        self.job = a.Archive(self.args)
        self.job.db.execute("INSERT INTO meta VALUES('source_sha256','fixture')")
        self.job.db.commit()
        (self.root / '.partial').mkdir()
        self.job.report = lambda *args, **kwargs: None

    def tearDown(self):
        self.job.db.close()
        self.job.lock.close()
        self.temp.cleanup()

    def row(self, url='https://example.org/image.png'):
        with self.job.db:
            self.job.db.execute('INSERT INTO assets(url,type,expected,phase,rank) VALUES(?,?,?,0,0)', (url, 'image/png', 6))
        return self.job.db.execute('SELECT * FROM assets WHERE url=?', (url,)).fetchone()

    def source(self, response):
        return patch.object(a, 'open_source', return_value=(io.BytesIO(), response, 'https://example.org/image.png'))

    def partial(self, row, data):
        part = self.root / '.partial' / (hashlib.sha256(row['url'].encode()).hexdigest() + '.part')
        part.write_bytes(data)
        part.with_suffix('.json').write_text(json.dumps({'validator': '"v1"'}))
        return part

    def test_group_order_then_file_size_and_unknown_last(self):
        path = Path(self.temp.name) / 'assets.csv'
        with path.open('w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['url', 'content_type', 'bytes', 'category', 'current_references'])
            for name, kind, size, category in [('large', 'image/png', 8, 'asset'), ('small', 'image/png', 1, 'asset'), ('first', 'audio/flac', 3, 'asset'), ('unknown', 'audio/flac', '', 'asset'), ('link', 'audio/flac', 1, 'link')]:
                w.writerow(['https://example.org/' + name, kind, size, category, 0])
        self.job.import_csv(path)
        rows = self.job.db.execute('SELECT url FROM assets ORDER BY phase,rank,expected,id').fetchall()
        self.assertEqual([r[0].split('/')[-1] for r in rows], ['first', 'small', 'large', 'unknown'])

    def priority_csv(self):
        path = Path(self.temp.name) / 'priority.csv'
        with path.open('w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['url', 'content_type', 'bytes', 'category', 'current_references'])
            w.writerows([
                ['https://example.org/history', 'text/plain', 1, 'asset', 0],
                ['https://example.org/current-large', 'video/mp4', 800, 'asset', 1],
                ['https://example.org/current-small', 'image/png', 6, 'asset', 2],
                ['https://example.org/current-unknown', 'image/png', '', 'asset', 1],
            ])
        return path

    def test_current_including_unknown_precedes_all_history(self):
        self.job.import_csv(self.priority_csv())
        rows = self.job.db.execute(f'SELECT url FROM assets ORDER BY {a.QUEUE_ORDER}').fetchall()
        self.assertEqual([r[0].split('/')[-1] for r in rows], ['current-small', 'current-large', 'current-unknown', 'history'])

    def test_reprioritization_preserves_files_and_completed_outcomes(self):
        path = self.priority_csv()
        self.job.import_csv(path)
        row = self.job.db.execute("SELECT * FROM assets WHERE url LIKE '%current-small'").fetchone()
        with self.source(Response(b'abcdef')):
            self.job.download(row)
        before = dict(self.job.db.execute('SELECT * FROM assets WHERE id=?', (row['id'],)).fetchone())
        with self.job.db:
            self.job.db.execute('UPDATE assets SET priority=1')
        self.job.prioritize(path)
        after = dict(self.job.db.execute('SELECT * FROM assets WHERE id=?', (row['id'],)).fetchone())
        self.assertEqual(before, after)
        self.assertEqual((self.root / after['path']).read_bytes(), b'abcdef')
        path.write_text(path.read_text().replace('current-small', 'different'))
        with self.assertRaises(ValueError):
            self.job.prioritize(path)
        self.assertEqual(self.job.db.execute('SELECT COUNT(*) FROM blobs').fetchone()[0], 1)

    def test_small_connection_setups_overlap_and_complete_with_serial_storage(self):
        import threading
        self.args.connections = 4
        for i in range(4):
            self.row(f'https://example.org/{i}')
        barrier = threading.Barrier(4)
        resources = []
        def open_parallel(url, headers):
            barrier.wait(timeout=3)  # Fails if setup is serialized.
            conn, response = io.BytesIO(), Response(b'abcdef')
            resources.append((conn, response))
            return conn, response, url
        with patch.object(a, 'open_source', side_effect=open_parallel):
            self.assertEqual(self.job.run(), 0)
        self.assertEqual(self.job.db.execute("SELECT COUNT(*) FROM assets WHERE status='done'").fetchone()[0], 4)
        self.assertEqual(self.job.used, 6)
        self.assertTrue(all(c.closed and r.closed for c, r in resources))

    def test_prefetched_connections_close_when_storage_blocks(self):
        self.args.connections = 4
        self.args.max_bytes = 4
        resources = []
        for i in range(4):
            self.row(f'https://example.org/{i}')
        def opened(url, headers):
            conn, response = io.BytesIO(), Response(b'abcdef')
            resources.append((conn, response))
            return conn, response, url
        with patch.object(a, 'open_source', side_effect=opened):
            self.assertEqual(self.job.run(), 75)
        self.assertTrue(all(c.closed and r.closed for c, r in resources))
        self.assertEqual(self.job.used, 0)
        self.assertTrue((Path(self.args.state) / 'last-error.json').exists())

    def test_hash_dedup_and_portable_paths(self):
        for url in ['https://example.org/a', 'https://example.org/b']:
            with self.source(Response(b'abcdef')):
                self.job.download(self.row(url))
        self.assertEqual(self.job.used, 6)
        self.assertEqual(self.job.db.execute('SELECT COUNT(*) FROM blobs').fetchone()[0], 1)
        rows = self.job.db.execute('SELECT * FROM assets').fetchall()
        self.assertEqual(rows[0]['path'], rows[1]['path'])
        self.assertEqual((self.root / rows[0]['path']).read_bytes(), b'abcdef')

    def test_resume_requires_valid_range(self):
        row = self.row()
        self.partial(row, b'abc')
        with self.source(Response(b'def', 206, {'Content-Range': 'bytes 3-5/6'})) as source:
            self.job.download(row)
        self.assertEqual(source.call_args.args[1], {'Range': 'bytes=3-', 'If-Range': '"v1"'})
        self.assertEqual(self.job.db.execute('SELECT sha256 FROM assets').fetchone()[0], hashlib.sha256(b'abcdef').hexdigest())

    def test_ignored_range_restarts_file(self):
        row = self.row()
        self.partial(row, b'old')
        with self.source(Response(b'abcdef')):
            self.job.download(row)
        self.assertEqual(self.job.used, 6)

    def test_truncation_never_becomes_completed(self):
        row = self.row()
        with self.source(Response(b'abc', headers={'Content-Length': '6'})), self.assertRaises(a.Unavailable):
            self.job.download(row)
        self.assertEqual(self.job.db.execute('SELECT COUNT(*) FROM blobs').fetchone()[0], 0)

    def test_invalid_range_rejected(self):
        row = self.row()
        self.partial(row, b'abc')
        with self.source(Response(b'def', 206, {'Content-Range': 'bytes 2-4/6'})), self.assertRaises(a.Unavailable):
            self.job.download(row)

    def test_budget_and_unknown_length_bound(self):
        self.args.max_bytes = 4
        row = self.row()
        with self.source(Response(b'abcdef')), self.assertRaises(a.StorageFull):
            self.job.download(row)
        with self.source(Response(b'abcdef', headers={'Content-Length': None})), self.assertRaises(a.StorageFull):
            self.job.download(row)
        self.assertEqual(self.job.used, 0)

    def test_html_and_private_rejected(self):
        row = self.row()
        for headers in [{'Content-Type': 'text/html'}, {'Cache-Control': 'private'}]:
            with self.source(Response(b'abcdef', headers=headers)), self.assertRaises(a.Unavailable):
                self.job.download(row)

    def test_no_local_fallback_when_mount_missing(self):
        self.args.mount = str(Path(self.temp.name) / 'absent')
        with self.assertRaises(a.StorageFull):
            self.job.check_mount()
        self.assertFalse(Path(self.args.mount).exists())

    def test_public_address_validation(self):
        for url in ['file:///etc/passwd', 'http://user:password@example.org/', 'http://example.org:22/']:
            with self.assertRaises(ValueError):
                a.public_target(url)
        for ip in ['127.0.0.1', '192.168.1.164', '169.254.169.254', '100.64.1.2', '224.0.0.1', '::1']:
            with patch.object(a.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', (ip, 80))]), self.assertRaises(ValueError):
                a.public_target('http://example.org/')
        with patch.object(a.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', ('1.1.1.1', 443))]):
            self.assertEqual(a.public_target('https://example.org/')[3], '1.1.1.1')

    def test_one_process_per_state(self):
        with self.assertRaises(BlockingIOError):
            other = a.Archive(self.args)


if __name__ == '__main__':
    unittest.main()
