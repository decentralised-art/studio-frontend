# Studio MIDI Plugin Contract

The Studio MIDI plugin is an in-app Studio plugin. It converts connector run output into a MIDI clip when the active root connector declares a compatible MIDI format hash.

## Stream Contract

The plugin expects complete scalar stream groups in the chain `/execute` response. A group is MIDI-ready only when it contains all of these streams:

- `pitch`: absolute MIDI pitch values from `0` to `127`.
- `time`: note start positions in beats. Values must be finite and non-negative.
- `duration`: note durations in beats. Values must be finite and greater than `0`.
- `velocity`: MIDI velocity values from `0` to `127`.

`durationv2` is accepted as a current compatibility alias for `duration`.

The plugin does not invent missing values. Missing streams, missing array entries, invalid pitch/time/duration/velocity values, or incomplete groups are reported as diagnostics and do not produce MIDI notes.

## Playback And Export

Playback uses Tone.js in the browser. MIDI export writes a Standard MIDI file using the validated clip model.

Playback modes:

- Analog synth: the default lightweight Tone.js `PolySynth` preview.
- Grand piano: a Tone.js `Sampler` preview using local MP3 samples served from `static/samples/piano`. Samples are loaded lazily on first piano playback. The current sampler map uses representative notes from `C1` through `C8`; Tone.js interpolates missing pitches and MIDI note velocity controls playback gain.

Current defaults:

- Tempo: `120` BPM.
- PPQ: `480`.
- Channel assignment: one channel per mapped stream group, wrapping after channel 16.

Future plugin UI may expose tempo, quantization, and track/channel controls, but these should remain explicit user settings rather than hidden fallbacks.

Sample attribution: Salamander Grand Piano by Alexander Holm, licensed under CC BY 3.0.
