# Neon world soundtrack

Eight original instrumental synth pieces at **72 BPM**, with half-time percussion, evolving minor/add-nine pads, bass pulses and spacious melodic phrases. Each piece lasts 5 minutes 20 seconds; the full playlist lasts **42 minutes 40 seconds** before a track repeats. Motifs recur within pieces as part of the composition.

1. Midnight Circuit
2. Blue Horizon
3. Glass Signals
4. Quiet Machines
5. Afterimage
6. Distant Terminal
7. Ion Drift
8. Dawn Return

Every node serves the versioned MP3s locally under `/music/`. Playback follows a continuous shared UTC timeline, including across midnight. Existing Radio play/pause and volume controls still apply; parcel audio ducks the background score. No remote music service or generated announcements are needed. The older 80-second Neon Transit file remains available for compatibility but is no longer in the active playlist.

Composition source: `scripts/compose-world-score.py`. Recreate from the repository root with Python, NumPy and ffmpeg. Stereo 44.1 kHz / 160 kbps MP3, approximately 51 MB total. All parts are synthesized from scratch without sampled recordings or borrowed melodies. Composition and recording use the repository’s MIT license.
