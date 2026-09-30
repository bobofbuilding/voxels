#!/bin/sh
# Linux user-service installer. A separately mounted archive and a public inventory are required.
set -eu
umask 077
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 /path/assets.csv[.gz] /mounted/archive [/local/state]" >&2
  exit 2
fi
source_csv=$(realpath "$1")
archive_mount=$(realpath "$2")
state=${3:-"$HOME/.local/share/voxels/media-archive"}
state=$(realpath -m "$state")
mountpoint -q "$archive_mount"
command -v python3 >/dev/null
if systemctl --user is-active --quiet voxels-media-archive.service; then
  echo 'Downloader already running; stop it before an explicit upgrade.' >&2
  exit 1
fi
mkdir -p "$state" "$archive_mount/media" "$HOME/.config/systemd/user"
cp "$(dirname "$0")/archive.py" "$state/archive.py"
if [ ! -f "$state/catalog.sqlite" ]; then
  if [ -f "$archive_mount/media/catalog.sqlite" ]; then
    cp "$archive_mount/media/catalog.sqlite" "$state/catalog.sqlite"
  else
    python3 "$state/archive.py" import --root "$archive_mount/media" --state "$state" --csv "$source_csv"
  fi
fi
python3 - "$state" "$archive_mount" <<'PY'
import json, os, pathlib, sys
state, mount = sys.argv[1:]
args = ['/usr/bin/python3', state+'/archive.py', 'run', '--root', mount+'/media', '--state', state, '--mount', mount,
        '--max-bytes', os.environ.get('MEDIA_ARCHIVE_MAX_BYTES', '1350000000000'),
        '--rate', os.environ.get('MEDIA_ARCHIVE_RATE', '8000000')]
quote = lambda value: json.dumps(value.replace('%', '%%'))
unit = '''[Unit]
Description=Resumable public Voxels media archive
After=network-online.target
[Service]
Type=simple
ExecStart='''+' '.join(map(quote, args))+'''
Restart=on-failure
RestartPreventExitStatus=75
RestartSec=300
TimeoutStopSec=45
MemoryMax=384M
CPUQuota=50%
Nice=10
UMask=0077
[Install]
WantedBy=default.target
'''
(pathlib.Path.home()/'.config/systemd/user/voxels-media-archive.service').write_text(unit)
PY
systemctl --user daemon-reload
systemctl --user enable --now voxels-media-archive.service
printf 'Downloader started. Status: %s/status.json\nArchive: %s/media\n' "$state" "$archive_mount"
