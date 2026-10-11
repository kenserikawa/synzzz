# Synzzz

*Synzzz* is a small synthesizer that runs in the browser: play it with the mouse, a touch screen or your computer keyboard, add effects, and record what you play into a piano roll. It also works as a Telegram Mini App.

## Features

- **Two-octave keyboard** (C3–B4), playable with mouse, touch (glissando and multi-touch) and the computer keyboard
- **Four waveforms**: sine, square, triangle, sawtooth
- **Effects**: stereo chorus, delay with darkening repeats, and reverb with an adjustable length (1–9 s)
- **Master volume and mute**
- **Oscilloscope and spectrum (EQ) screens** showing what you hear
- **Metronome** with accented downbeat and tap tempo
- **Recorder and piano roll**: record a take, play it back or loop it, drag notes in time, nudge them with the arrow keys and delete them with a double click or Delete

## Getting started

The app uses ES modules, which browsers do not load from `file://`. Serve the folder with any static server:

```bash
git clone git@github.com:kenserikawa/synzzz.git
cd synzzz
python3 -m http.server 8000
# open http://localhost:8000
```

### Computer keyboard

| Row | Keys | Notes |
| --- | --- | --- |
| Bottom, white keys | `Z X C V B N M` | C3 – B3 |
| Home, black keys | `S D` · `G H J` | C#3 D#3 · F#3 G#3 A#3 |
| Top, white keys | `Q W E R T Y U` | C4 – B4 |
| Numbers, black keys | `2 3` · `5 6 7` | C#4 D#4 · F#4 G#4 A#4 |

Keys are matched by physical position, so the layout is the same on QWERTZ and AZERTY keyboards. The letter for each note is printed on the on-screen key.

## Project structure

```
index.html            markup; loads app.js as an ES module
app.js                creates the components and wires them together
style.css
component/
  synth.js            audio engine: voices, envelope, effects, soft clipper, analyser
  keyboard.js         pointer + computer keyboard input → note on / note off
  recorder.js         records notes with start time and duration
  arrangement.js      holds the take and plays it back (lookahead scheduler)
  arrangement-view.js piano roll: rendering, playhead, note editing
  metronome.js        click track and tap tempo
  visualizer.js       oscilloscope and EQ canvases
util/
  note-frequencies.js note name → frequency (equal temperament, A4 = 440 Hz)
  key-bindings.js     computer key → note
  waveforms.js        waveform list for the selector
  rotated-panel.js    rotated synth panel on phones in portrait
instrument/           work in progress, not used by the app yet
```

## Technical requirements

A current browser with Web Audio and Pointer Events: Chrome, Edge, Firefox or Safari. Vertical faders use `writing-mode` on range inputs (Chrome 124+, Firefox 120+ and Safari 17.4+); older browsers show them horizontal.

## Contributing

Contributions are welcome. Fork the repository and open a pull request.

## License

Synzzz is open-source software licensed under the MIT license.
