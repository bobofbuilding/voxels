#!/usr/bin/env python3
"""Build a reproducible torrent for immutable seed objects (stdlib only)."""
import pathlib,hashlib,sys,json

def encode(v):
 if isinstance(v,int): return b'i'+str(v).encode()+b'e'
 if isinstance(v,str): v=v.encode()
 if isinstance(v,bytes): return str(len(v)).encode()+b':'+v
 if isinstance(v,list): return b'l'+b''.join(encode(x) for x in v)+b'e'
 if isinstance(v,dict): return b'd'+b''.join(encode(k)+encode(v[k]) for k in sorted(v))+b'e'
 raise TypeError(type(v))

root=pathlib.Path(sys.argv[1]); output=pathlib.Path(sys.argv[2])
# Exclude mutable latest pointers and operational verification markers.
files=sorted([*root.glob('chunks/*'),*root.glob('manifests/*'),root/'publisher.pem'])
piece_size=1024*1024; pending=bytearray(); pieces=[]; entries=[]
for file in files:
 if file.is_symlink() or not file.is_file() or file.name.endswith('.partial'): raise ValueError('Only complete regular seed files allowed')
 entries.append({'length':file.stat().st_size,'path':list(file.relative_to(root).parts)})
 with file.open('rb') as stream:
  while True:
   block=stream.read(piece_size-len(pending))
   if not block: break
   pending.extend(block)
   if len(pending)==piece_size:
    pieces.append(hashlib.sha1(pending).digest()); pending.clear()
if pending: pieces.append(hashlib.sha1(pending).digest())
info={'name':'seed','piece length':piece_size,'pieces':b''.join(pieces),'files':entries}
torrent={'announce':'udp://tracker.opentrackr.org:1337/announce','info':info,
 'comment':'Public Voxels builds and saved history. Verify SHA-256 manifests and publisher signature; no external media.'}
output.write_bytes(encode(torrent))
infohash=hashlib.sha1(encode(info)).hexdigest()
print(json.dumps({'infoHash':infohash,'bytes':sum(x['length'] for x in entries),'files':len(files),'magnet':'magnet:?xt=urn:btih:'+infohash+'&dn=Voxels-public-builds-2026-09-30&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce'}))
