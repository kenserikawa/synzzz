# CLAUDE.md

Guidance for Claude Code sessions in this repository. User-facing overview: README.md.

## What this is

Synzzz: a browser synthesizer in vanilla JavaScript (ES modules, no framework, no build, no package.json). Also loaded as a Telegram Mini App (`telegram-web-app.js` in `index.html`; `app.js` only calls the Telegram API when `Telegram.WebApp.initData` is set).

## Run and verify

- Serve statically; ES modules do not load from `file://`: `python3 -m http.server 8000`.
- No test suite. Verify audio changes by rendering offline in the page console:
  `const { default: Synth } = await import('/component/synth.js'); const ctx = new OfflineAudioContext(2, 48000, 48000); const s = new Synth(ctx); s.playNote(440, 0, 0.5); const buf = await ctx.startRendering();`
  then inspect peaks / RMS of `buf.getChannelData(0)`. Reference values (48 kHz): one sine A4 at default volume peaks ≈ 0.19; 8 square notes at full volume peak ≈ 0.93 (must stay < 1).
- Check UI at desktop width and at 390 px (phone portrait: the synth panel is rotated).

## Architecture

`app.js` builds everything and wires callbacks; components do not import each other except through what `app.js` passes in.

- `component/synth.js` — audio engine. The graph is built once in `buildGraph()`; never create effect nodes per note or per fader event. Voices: `noteOn/noteOff(note)` for held notes (Map keyed by note name), `playNote(freq, when, duration)` for scheduled one-shots (Set, cleared by `stopScheduled()`). Every voice disconnects itself in `onended`. Effect parameters change through `smooth()` (setTargetAtTime), not by assigning `.value`.
- `component/keyboard.js` — Pointer Events on `.piano` (delegated, pointer capture + `elementFromPoint` for glissando) and `keydown/keyup` by `event.code`. Notes are refcounted (`holds`) so two sources holding one note release it once.
- `component/recorder.js` — `{ note, time, duration }` in seconds from the start of the take, on `audioContext.currentTime`.
- `component/arrangement.js` and `component/metronome.js` — lookahead schedulers: a 25 ms `setInterval` schedules audio up to 100 ms ahead (1.5 s when `document.hidden`). Never play notes from `setTimeout` at their musical time.
- `component/arrangement-view.js` — piano roll. Rows and cursor are created once; `render()` only rebuilds the note layer. Notes keep `data-index` = index in `arrangement.notes`.
- `component/visualizer.js` — one rAF loop for both canvases; reads `synth.analyser` (post-clipper, i.e. what is heard).
- `util/` — `note-frequencies.js` (keys `C3`…`B5`, insertion order = pitch order), `key-bindings.js` (`event.code` → note), `waveforms.js`, `rotated-panel.js`.
- `instrument/` — unfinished OOP instrument hierarchy, not imported anywhere. Each `Instrument` creates its own `AudioContext`; inject the shared one before wiring it in.

## Conventions

- Note names use scientific pitch (`C3`, `C#4`). The keys in `index.html` (`data-note`) define which notes exist on the keyboard and in the piano roll.
- 4-space indentation, double quotes in imports, single quotes elsewhere, ES classes with a default export per component file.
- Colours and key sizes are CSS custom properties in `:root` of `style.css`; the phone layout lives in the `max-width: 768px` media query plus `util/rotated-panel.js`.
- UI text is in English.
