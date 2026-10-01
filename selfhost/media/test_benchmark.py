import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import benchmark as b


class Response(io.BytesIO):
    def __init__(self, payload=b'abcdef', status=200, headers=None):
        super().__init__(payload)
        self.status = status
        self.headers = headers or {}

    def getheader(self, key):
        return self.headers.get(key)


class Connection(io.BytesIO):
    sock = None


class BenchmarkTests(unittest.TestCase):
    def test_comparison_is_bounded_and_uses_same_sources(self):
        calls, responses = [], []
        def source(url, headers):
            calls.append((url, headers))
            response = Response(); responses.append(response)
            return Connection(), response, url
        with patch.object(b, 'open_source', side_effect=source):
            result = b.run(['https://example.org/a', 'https://example.org/b'], sample_bytes=3)
        self.assertEqual(len(calls), 8)
        self.assertEqual([c['connections'] for c in result['cases']], [1, 4, 4, 1])
        self.assertTrue(all(c['bytes'] == 6 for c in result['cases']))
        self.assertTrue(all(r.closed for r in responses))

    def test_throttle_stops_remaining_identity_and_connection_tests(self):
        with patch.object(b, 'open_source', return_value=(Connection(), Response(status=429, headers={'Retry-After': '60'}), 'https://example.org/a')) as source:
            result = b.run(['https://example.org/a', 'https://example.org/b'])
        self.assertTrue(result['stopped_for_throttling'])
        self.assertEqual(source.call_count, 1)
        self.assertEqual(len(result['cases']), 1)
        self.assertEqual(result['cases'][0]['samples'][0]['headers']['Retry-After'], '60')

    def test_rejects_unbounded_or_duplicate_work_before_requests(self):
        with patch.object(b, 'open_source') as source:
            for urls, size in [([], 3), (['https://example.org/a'] * 2, 3), (['https://example.org/a'], 5_000_000)]:
                with self.assertRaises(ValueError):
                    b.run(urls, size)
        source.assert_not_called()
