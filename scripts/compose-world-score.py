"""Render Neon Transit: an original 32-bar electronic world score.
Requires Python + numpy and ffmpeg. No samples or existing melodies used.
Run from the repository root: python3 scripts/compose-world-score.py
"""
import math
import subprocess
import tempfile
import wave
from pathlib import Path
import numpy as np

RATE = 44100
BPM = 96
BEAT = 60 / BPM
DURATION = 80
rng = np.random.default_rng(7119)
mix = np.zeros((RATE * DURATION, 2), dtype=np.float64)

def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)

def add(signal, start, gain, pan=0):
    offset = round(start * RATE)
    end = min(len(mix), offset + len(signal))
    if end <= offset:
        return
    signal = signal[:end-offset] * gain
    mix[offset:end, 0] += signal * math.sqrt((1-pan)/2)
    mix[offset:end, 1] += signal * math.sqrt((1+pan)/2)

def tone(note, duration, attack=.012, release=.12, harmonics=3, detune=0):
    t = np.arange(round(duration * RATE)) / RATE
    phase = 2*np.pi*frequency(note)*t
    signal = sum(np.sin(phase * k + detune*np.sin(t*.8)) / k**1.6 for k in range(1, harmonics+1))
    envelope = np.minimum(1, t/attack) * np.minimum(1, (duration-t)/release)
    return signal * np.clip(envelope, 0, 1)

# Four original minor/add-nine voicings, slow pads over a restrained pulse.
chords = [(38, [50, 57, 60, 64]), (34, [46, 53, 57, 60]), (41, [53, 60, 64, 67]), (36, [48, 55, 58, 62])]
for bar in range(32):
    start = bar * BEAT * 4
    root, notes = chords[(bar//2) % 4]
    intensity = .65 if bar < 4 or bar >= 28 else 1
    for i, note in enumerate(notes):
        add(tone(note, BEAT*4+.35, .55, .6, 2, .2), start, .045*intensity, (i-1.5)/2.2)
    if bar >= 2:
        for beat in range(4):
            add(tone(root, BEAT*.72, .008, .15, 5), start+beat*BEAT, .18*intensity)
            t = np.arange(round(.35*RATE))/RATE
            kick = np.sin(2*np.pi*(43*t+8*(1-np.exp(-t*28))))*np.exp(-t*15)
            add(kick, start+beat*BEAT, .18*intensity)
    if 4 <= bar < 28:
        for step in range(8):
            note = notes[[0, 2, 1, 3, 2, 1, 3, 0][step]] + 12
            phrase = tone(note, .34, .005, .3, 3)*np.exp(-np.arange(round(.34*RATE))/RATE*5)
            onset = start+step*BEAT/2
            add(phrase, onset, .075, .35 if step%2 else -.35)
            add(phrase, onset+BEAT*.75, .023, -.5 if step%2 else .5)
            noise = rng.standard_normal(round(.075*RATE))
            high = np.diff(noise, prepend=0) * np.exp(-np.arange(len(noise))/RATE*75)
            add(high, onset, .013, .3)
        for beat in [1, 3]:
            t = np.arange(round(.18*RATE))/RATE
            snare = (rng.standard_normal(len(t))*.4+np.sin(2*np.pi*180*t)*.3)*np.exp(-t*25)
            add(snare, start+beat*BEAT, .055)
# Gentle repeating ambience; endpoints fade cleanly when the station repeats.
for delay, gain in [(.19,.12),(.37,.08),(.61,.05)]:
    shift=round(delay*RATE)
    mix[shift:] += mix[:-shift, ::-1].copy()*gain
fade=round(2*RATE)
mix[:fade] *= np.linspace(0,1,fade)[:,None]
mix[-fade:] *= np.linspace(1,0,fade)[:,None]
mix *= .78 / max(np.max(np.abs(mix)), 1e-8)
output=Path('dist/music/neon-transit-v1.mp3')
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as folder:
    wav=Path(folder)/'score.wav'
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(RATE)
        f.writeframes((mix*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','192k','-metadata','title=Neon Transit','-metadata','artist=Bittrees World',str(output)],check=True)
print(f'{output}: {DURATION}s, {BPM} BPM, original stereo score')
