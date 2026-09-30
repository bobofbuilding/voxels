"""Render eight original 72 BPM synth pieces (42m40s total).
Requires Python, NumPy and ffmpeg. No samples or existing melodies.
Run from the repository root: python3 scripts/compose-world-score.py
"""
import math
import subprocess
import tempfile
import wave
from pathlib import Path
import numpy as np

RATE = 44100
BPM = 72
BEAT = 60 / BPM
BARS = 96
DURATION = 320
PIECES = [
    ('midnight-circuit', 38, [0, -4, 3, -2, 5, 0], 8101),
    ('blue-horizon', 33, [0, 5, 3, 7, -2, 3], 8102),
    ('glass-signals', 40, [0, -2, -5, 3, 0, 5], 8103),
    ('quiet-machines', 36, [0, 3, -2, -4, 5, -2], 8104),
    ('afterimage', 35, [0, 5, -2, 3, -4, 0], 8105),
    ('distant-terminal', 31, [0, 7, 3, 5, -2, 0], 8106),
    ('ion-drift', 37, [0, -4, 5, 3, -2, 5], 8107),
    ('dawn-return', 34, [0, 3, 5, -2, 7, 0], 8108),
]


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def tone(note, duration, attack=.02, release=.2, harmonics=3, detune=.08):
    t = np.arange(round(duration * RATE), dtype=np.float32) / RATE
    phase = 2 * np.pi * frequency(note) * t
    signal = sum(np.sin(phase * k + detune * np.sin(t * .8)) / k**1.8 for k in range(1, harmonics + 1))
    envelope = np.minimum(1, t / attack) * np.minimum(1, (duration - t) / release)
    return signal * np.clip(envelope, 0, 1)


def render(name, key, progression, seed):
    rng = np.random.default_rng(seed)
    mix = np.zeros((RATE * DURATION, 2), dtype=np.float32)

    def add(signal, start, gain, pan=0):
        offset = round(start * RATE)
        end = min(len(mix), offset + len(signal))
        if end <= offset:
            return
        signal = signal[:end-offset] * gain
        mix[offset:end, 0] += signal * math.sqrt((1-pan)/2)
        mix[offset:end, 1] += signal * math.sqrt((1+pan)/2)

    kick_t = np.arange(round(.5 * RATE)) / RATE
    kick = np.sin(2*np.pi*(40*kick_t+7*(1-np.exp(-kick_t*20))))*np.exp(-kick_t*12)
    # Twelve sections vary density, voicing, melody and rhythmic placement.
    energy = [.25, .45, .65, .8, .55, .3, .5, .75, .9, .6, .4, .2]
    motifs = [rng.permutation(8).tolist() for _ in range(12)]
    for bar in range(BARS):
        section = bar // 8
        start = bar * 4 * BEAT
        root = key + progression[(bar // 4 + section // 3) % len(progression)]
        voicing = [12, 19, 22 if section % 3 else 15, 26 if seed % 2 else 29]
        notes = [root + n for n in voicing]
        level = energy[section]
        if bar % 2 == 0:
            for i, note in enumerate(notes):
                pad = tone(note, 8*BEAT+.7, 1.2, 1.5, 2, .28)
                add(pad, start, .04, (i-1.5)/2)
        if section not in (0, 5, 11):
            for beat in ([0, 2] if seed % 2 else [0, 2.5]):
                add(tone(root, BEAT*.95, .035, .4, 4), start+beat*BEAT, .15*level)
                add(kick, start+beat*BEAT, .13*level)
            # Soft half-time snare, not the previous four-on-the-floor beat.
            t = np.arange(round(.25*RATE)) / RATE
            noise = rng.standard_normal(len(t))
            smooth = np.convolve(noise, np.ones(9)/9, mode='same')
            add(smooth*np.exp(-t*22), start+2*BEAT, .045*level, -.15)
        if section >= 2 and section != 5 and section < 11:
            count = 4 if section in (4, 9, 10) else 8
            for step in range(count):
                note = notes[motifs[section][(step+bar%4)%8] % 4] + (12 if (bar+seed)%3 else 0)
                phrase = tone(note, .8, .015, .6, 2 + seed%2)
                phrase *= np.exp(-np.arange(len(phrase))/RATE*3)
                onset = start + step * BEAT * 4/count
                pan = .5 * math.sin(step + section)
                add(phrase, onset, .055*level, pan)
                add(phrase, onset+BEAT*.75, .018*level, -pan)
                add(phrase, onset+BEAT*1.5, .008*level, pan)
        # Sparse high melodic answers distinguish each evolving phrase.
        if section in (3, 6, 7, 8, 9) and bar % 4 in (1, 3):
            note = notes[(bar//4 + seed) % 4] + 12
            add(tone(note, BEAT*2.7, .35, 1, 1), start+BEAT*.5, .04, -.3)
    for delay, gain in [(.23,.1),(.47,.07),(.79,.04)]:
        shift = round(delay*RATE)
        mix[shift:] += mix[:-shift, ::-1].copy()*gain
    fade = round(5*RATE)
    mix[:fade] *= np.linspace(0,1,fade)[:,None]
    mix[-fade:] *= np.linspace(1,0,fade)[:,None]
    peak = float(np.max(np.abs(mix)))
    assert np.isfinite(mix).all() and peak > .01
    mix *= .72/peak
    output = Path('dist/music') / (name+'-v2.mp3')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as folder:
        wav = Path(folder)/'score.wav'
        with wave.open(str(wav),'wb') as f:
            f.setnchannels(2); f.setsampwidth(2); f.setframerate(RATE)
            f.writeframes((mix*32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','160k',
                        '-metadata','title='+name.replace('-',' ').title(),'-metadata','artist=Bittrees World',str(output)],check=True)
    print(f'{output}: {DURATION}s, {BPM} BPM',flush=True)


if __name__ == '__main__':
    for piece in PIECES:
        render(*piece)
