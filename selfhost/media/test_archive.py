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

    def staging(self, workers=4, limit=64):
        self.args.workers = workers
        self.args.stage_file_bytes = limit
        self.args.checkpoint_seconds = 3600

    def test_parallel_payloads_and_single_archive_writer_deduplicate(self):
        import threading
        self.staging()
        for i in range(4):
            self.row(f'https://example.org/{i}')
        barrier = threading.Barrier(4)
        main_thread = threading.get_ident()
        original = Path.open
        class ParallelResponse(Response):
            def read(self, size=-1):
                if self.tell() == 0:
                    barrier.wait(timeout=3)
                return super().read(size)
        def opened(url, headers):
            return io.BytesIO(), ParallelResponse(b'abcdef'), url
        def guarded_open(path, mode='r', *args, **kwargs):
            if path.is_relative_to(self.root) and any(c in mode for c in 'wax'):
                self.assertEqual(threading.get_ident(), main_thread)
                self.assertNotIn('a', mode)
            return original(path, mode, *args, **kwargs)
        with patch.object(a, 'open_source', side_effect=opened), patch.object(Path, 'open', guarded_open):
            self.assertEqual(self.job.run(), 0)
        self.assertEqual(self.job.db.execute("SELECT COUNT(*) FROM assets WHERE status='done'").fetchone()[0], 4)
        self.assertEqual(self.job.used, 6)
        self.assertEqual(list(Path(self.args.state).glob('staging-*')), [])

    def test_rolling_queue_commits_ready_files_and_refills_before_slow_source(self):
        import threading
        self.staging(workers=2)
        slow_release = threading.Event()
        started = []
        completed = []
        original_finish = self.job.finish
        for i in range(5):
            self.row(f'https://example.org/{i}')
        def finish(row, status, **fields):
            if status == 'done':
                completed.append(row['url'])
                if row['url'].endswith('/3'):
                    slow_release.set()
            return original_finish(row, status, **fields)
        def opened(url, headers):
            started.append(url)
            if url.endswith('/0'):
                if not slow_release.wait(timeout=5):
                    raise AssertionError('Ready peers or replacement downloads blocked behind slow source')
            return io.BytesIO(), Response(url.encode()), url
        with patch.object(a, 'open_source', side_effect=opened), patch.object(self.job, 'finish', side_effect=finish):
            try:
                self.assertEqual(self.job.run(), 0)
            finally:
                slow_release.set()
        self.assertLess(completed.index('https://example.org/3'), completed.index('https://example.org/0'))
        self.assertEqual(len(completed), 5)
        self.assertEqual(len(started), 5)

    def test_rolling_refill_counts_outstanding_space_reservations(self):
        from concurrent.futures import Future
        from collections import namedtuple
        self.staging(workers=2, limit=64)
        first = self.row('https://example.org/0')
        self.row('https://example.org/1')
        self.job.stage_futures[first['id']] = Future()
        self.job.stage_progress[first['id']] = {'bytes': 4}
        self.job.pool = unittest.mock.Mock()
        usage = namedtuple('usage', 'total used free')(1000, 900, 100)
        with patch.object(a.shutil, 'disk_usage', return_value=usage), self.assertRaises(a.StorageFull):
            self.job.prepare_stages(first)  # 60 outstanding + 64 new + headroom cannot fit.
        self.job.pool.submit.assert_not_called()

    def test_staged_queue_preserves_scope_and_type_order(self):
        self.staging()
        self.job.import_csv(self.priority_csv())
        calls = []
        def opened(url, headers):
            calls.append(url.rsplit('/', 1)[-1])
            return io.BytesIO(), Response(b'abcdef'), url
        with patch.object(a, 'open_source', side_effect=opened):
            self.assertEqual(self.job.run(), 0)
        self.assertEqual(calls, ['current-small', 'current-large', 'current-unknown', 'history'])

    def test_staged_unknown_size_overflow_falls_back_without_skipping(self):
        self.staging(workers=2, limit=4)
        row = self.row()
        self.job.db.execute('UPDATE assets SET expected=NULL')
        self.job.db.commit()
        sizes = []
        def opened(url, headers):
            sizes.extend(p.stat().st_size for p in Path(self.args.state).glob('staging-*/*.stage'))
            return io.BytesIO(), Response(b'abcdef', headers={'Content-Length': None}), url
        with patch.object(a, 'open_source', side_effect=opened) as source:
            self.assertEqual(self.job.run(), 0)
        self.assertEqual(source.call_count, 2)
        self.assertTrue(all(n <= 4 for n in sizes))
        self.assertEqual(self.job.used, 6)

    def test_staged_budget_failure_retains_completed_archive(self):
        self.staging(workers=2)
        self.args.max_bytes = 6
        for i in range(2):
            self.row(f'https://example.org/{i}')
        def opened(url, headers):
            return io.BytesIO(), Response(b'abcdef' if url.endswith('0') else b'ghijkl'), url
        with patch.object(a, 'open_source', side_effect=opened):
            self.assertEqual(self.job.run(), 75)
        self.assertEqual(self.job.used, 6)
        self.assertEqual(self.job.db.execute("SELECT COUNT(*) FROM assets WHERE status='done'").fetchone()[0], 1)
        path = self.job.db.execute('SELECT path FROM blobs').fetchone()[0]
        self.assertEqual((self.root / path).read_bytes(), b'abcdef')

    def test_staging_reserves_local_space_before_network(self):
        self.staging()
        for i in range(4):
            self.row(f'https://example.org/{i}')
        from collections import namedtuple
        usage = namedtuple('usage', 'total used free')(1000, 900, 100)
        with patch.object(a.shutil, 'disk_usage', return_value=usage), patch.object(a, 'open_source') as source:
            self.assertEqual(self.job.run(), 75)
        source.assert_not_called()

    def test_staged_source_timeout_is_retried_and_terminal(self):
        self.staging()
        self.row()
        with patch.object(a, 'open_source', side_effect=TimeoutError('source timeout')), patch.object(a.time, 'sleep'):
            self.assertEqual(self.job.run(), 0)
        self.assertEqual(self.job.db.execute('SELECT status,tries FROM assets').fetchone()[:], ('failed', 3))

    def test_staged_stop_preserves_archive_and_pending_work(self):
        self.staging()
        self.row()
        job = self.job
        class StopResponse(Response):
            def read(self, size=-1):
                job.stopping = True
                return super().read(size)
        with patch.object(a, 'open_source', side_effect=lambda *args: (io.BytesIO(), StopResponse(b'abcdef'), args[0])):
            self.assertEqual(self.job.run(), 0)
        self.assertEqual(self.job.db.execute('SELECT status FROM assets').fetchone()[0], 'pending')
        self.assertEqual(self.job.used, 0)
        self.assertEqual(list(Path(self.args.state).glob('staging-*')), [])

    def test_aggregate_rate_budget_is_shared(self):
        self.args.rate = 1000
        self.job.rate_next = 0
        sleeps = []
        clock = [100.0]
        def sleep(seconds):
            sleeps.append(seconds)
            clock[0] += seconds
        with patch.object(a.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(a.time, 'sleep', side_effect=sleep):
            self.job.throttle(100)
            self.job.throttle(200)
        self.assertAlmostEqual(sum(sleeps), 0.3)

    def test_custom_checkpoint_interval(self):
        self.args.checkpoint_seconds = 3600
        self.job.report = a.Archive.report.__get__(self.job)
        self.job.last_snapshot = a.time.monotonic() - 1000
        with patch.object(self.job, 'snapshot') as snapshot:
            self.job.report(force=True)
            snapshot.assert_not_called()
            self.job.last_snapshot -= 3600
            self.job.report()
            snapshot.assert_called_once()

    def test_staging_rejects_private_and_truncated_responses(self):
        for headers, expected in [({'Cache-Control': 'private'}, 'skipped'), ({'Content-Length': '8'}, 'failed')]:
            with self.subTest(headers=headers):
                self.staging()
                row = self.row('https://example.org/' + expected)
                self.job.stopping = False
                with patch.object(a, 'open_source', side_effect=lambda *args: (io.BytesIO(), Response(b'abcdef', headers=headers), args[0])), patch.object(a.time, 'sleep'):
                    self.assertEqual(self.job.run(), 0)
                self.assertEqual(self.job.db.execute('SELECT status FROM assets WHERE id=?', (row['id'],)).fetchone()[0], expected)
        self.assertEqual(self.job.used, 0)

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

    def test_no_resume_restarts_partial_without_append_or_range(self):
        self.args.no_resume = True
        row = self.row()
        self.partial(row, b'old')
        original = Path.open
        def no_append(path, mode='r', *args, **kwargs):
            self.assertNotIn('a', mode)
            return original(path, mode, *args, **kwargs)
        with self.source(Response(b'abcdef')) as source, patch.object(Path, 'open', no_append):
            self.job.download(row)
        self.assertEqual(source.call_args.args[1], {})
        saved = self.job.db.execute('SELECT path FROM assets').fetchone()[0]
        self.assertEqual((self.root / saved).read_bytes(), b'abcdef')

    def test_due_checkpoint_waits_until_payload_closed(self):
        row = self.row()
        self.job.report = a.Archive.report.__get__(self.job)
        flags = []
        original_report = self.job.report
        def report(*args, **kwargs):
            flags.append(kwargs.get('allow_checkpoint', True))
            original_report(*args, **kwargs)
        self.job.report = report
        with self.source(Response(b'abcdef')), patch.object(self.job, 'snapshot') as snapshot:
            self.job.download(row)
            snapshot.assert_not_called()
            self.assertEqual(flags, [False])
            self.assertTrue((Path(self.args.state) / 'status.json').exists())
            self.assertFalse((self.root / 'status.json').exists())
            # Checkpoint is still due even though local progress was just reported.
            self.job.report()
            snapshot.assert_called_once()
            self.assertTrue((self.root / 'status.json').exists())

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
