#!/usr/bin/env python3
"""Bounded source-only comparison; never changes routes, proxies or downloader configuration."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
import json
from pathlib import Path
import threading
import time

from archive import open_source

AGENTS = ('VoxelsPublicArchive/1.0', 'VoxelsPublicArchive/1.0 (diagnostic)')
HEADERS = ('Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset',
           'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'CF-Cache-Status')


def sample(url, agent, sample_bytes, seconds, stop):
    result = {'url': url, 'bytes': 0}
    if stop.is_set():
        return {**result, 'outcome': 'not_started'}
    started = time.monotonic()
    conn = response = None
    digest = hashlib.sha256()
    try:
        conn, response, _ = open_source(url, {'User-Agent': agent})
        result.update(status=response.status, response_seconds=time.monotonic() - started,
                      headers={key: response.getheader(key) for key in HEADERS if response.getheader(key) is not None})
        if response.status == 429 or (response.status == 503 and response.getheader('Retry-After')):
            stop.set()
            result['outcome'] = 'throttled_stop'
            return result
        if response.status != 200:
            result['outcome'] = 'http_error'
            return result
        while result['bytes'] < sample_bytes and not stop.is_set():
            remaining = seconds - (time.monotonic() - started)
            if remaining <= 0:
                result['outcome'] = 'time_limit'
                break
            if conn.sock:
                conn.sock.settimeout(min(5, remaining))
            block = response.read(min(64 * 1024, sample_bytes - result['bytes']))
            if not block:
                result['outcome'] = 'complete'
                break
            digest.update(block)
            result['bytes'] += len(block)
        else:
            result['outcome'] = 'cancelled' if stop.is_set() else 'sample_limit'
        result['sample_sha256'] = digest.hexdigest()
    except (OSError, ValueError, http.client.HTTPException) as exc:
        result.update(outcome='error', error=str(exc)[:300])
    finally:
        if response:
            response.close()
        if conn:
            conn.close()
        result['seconds'] = time.monotonic() - started
    return result


def run(urls, sample_bytes=2_000_000, seconds=30):
    if not 1 <= len(urls) <= 8 or len(set(urls)) != len(urls):
        raise ValueError('Provide 1–8 distinct public asset URLs')
    if not 1 <= sample_bytes <= 4_000_000 or not 1 <= seconds <= 60:
        raise ValueError('Sample limits: 1–4,000,000 bytes and 1–60 seconds per request')
    stop, cases = threading.Event(), []
    # Reverse the connection order for the second honest identity to reduce simple ordering bias.
    for agent, connections in [(AGENTS[0], 1), (AGENTS[0], 4), (AGENTS[1], 4), (AGENTS[1], 1)]:
        if stop.is_set():
            break
        started = time.monotonic()
        with ThreadPoolExecutor(max_workers=connections) as pool:
            samples = list(pool.map(lambda url: sample(url, agent, sample_bytes, seconds, stop), urls))
        duration = time.monotonic() - started
        total = sum(s['bytes'] for s in samples)
        cases.append({'user_agent': agent, 'connections': connections, 'wall_seconds': duration,
                      'bytes': total, 'bytes_per_second': total / max(duration, 0.000001), 'samples': samples})
    return {'stopped_for_throttling': stop.is_set(), 'cases': cases,
            'note': 'Source-only sampled bytes, not unique archive growth. Run the same manifest on a separately authorized route to compare IPs. No IP rotation is performed. Shared bandwidth, cache state and background traffic can affect results.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--urls', required=True, help='JSON array of 1–8 public asset URLs; same manifest for each route')
    parser.add_argument('--route-label', required=True, help='Descriptive label only; does not change the network route')
    parser.add_argument('--output', required=True, help='New JSON report path (existing reports are never overwritten)')
    parser.add_argument('--sample-bytes', type=int, default=2_000_000)
    parser.add_argument('--seconds', type=int, default=30)
    args = parser.parse_args()
    urls = json.loads(Path(args.urls).read_text())
    if not isinstance(urls, list) or not all(isinstance(url, str) for url in urls):
        parser.error('Manifest must be a JSON array of URLs')
    # Check the destination before making any requests.
    with Path(args.output).open('x') as output:
        report = run(urls, args.sample_bytes, args.seconds)
        report.update(route_label=args.route_label, manifest_sha256=hashlib.sha256(json.dumps(urls).encode()).hexdigest(),
                      sample_bytes=args.sample_bytes, seconds=args.seconds,
                      finished_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
        json.dump(report, output, indent=2)
        output.write('\n')
    print(json.dumps({'report': args.output, 'stopped_for_throttling': report['stopped_for_throttling'],
                      'cases': [{k: case[k] for k in ('user_agent', 'connections', 'bytes_per_second')} for case in report['cases']]}))


if __name__ == '__main__':
    main()
