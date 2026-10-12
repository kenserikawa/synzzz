import ArrangementView from "./component/arrangement-view.js";
import Arrangement from "./component/arrangement.js";
import Recorder from "./component/recorder.js";
import Keyboard from "./component/keyboard.js";
import Metronome from "./component/metronome.js";
import Synth from "./component/synth.js";
import Visualizer from "./component/visualizer.js";

import { noteFrequencies } from "./util/note-frequencies.js";
import { waveforms } from "./util/waveforms.js";
import { fitRotatedPanel } from "./util/rotated-panel.js";
import { loadJSON, saveJSON } from "./util/storage.js";

const SETTINGS_KEY = 'synzzz:settings:v1';
const TAKE_KEY = 'synzzz:take:v1';
const CONTROL_IDS = [
    'volume-toggle', 'volume-fader', 'delay-toggle', 'delay-fader',
    'reverb-toggle', 'reverb-fader', 'chorus-toggle', 'chorus-fader',
];

const audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });

// Browsers keep an AudioContext suspended until the first user gesture. A touch only
// counts as one on pointerup/touchend (not pointerdown), so listen to all of them.
const unlockAudio = () => {
    if (audioContext.state !== 'running') audioContext.resume();
};
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(type =>
    document.addEventListener(type, unlockAudio, true)
);

// Inside Telegram (Mini App): take the full height and stop swipes on the keys from closing it.
const telegram = window.Telegram?.WebApp;
if (telegram?.initData) {
    telegram.ready();
    telegram.expand();
    telegram.disableVerticalSwipes?.();
}

const $ = id => document.getElementById(id);
const piano = document.querySelector('.piano');
const playableNotes = [...piano.querySelectorAll('.key')].map(key => key.dataset.note);

const synth = new Synth(audioContext);
const recorder = new Recorder(audioContext);
const arrangement = new Arrangement(audioContext, synth, noteFrequencies);
const arrangementView = new ArrangementView(arrangement, $('arrangement-view'), playableNotes, {
    // Let a note dragged to a new pitch be heard.
    onPreview: note => synth.playNote(noteFrequencies[note], audioContext.currentTime, 0.15),
});
const visualizer = new Visualizer(synth.analyser, $('waveformCanvas'), $('eqCanvas'));

// ── Saved state (localStorage) ───────────────────────────────────────────────

const settings = loadJSON(SETTINGS_KEY, {});
let settingsRestored = false; // don't save half-restored state while starting up

function saveSettings() {
    if (!settingsRestored) return;
    saveJSON(SETTINGS_KEY, {
        controls: Object.fromEntries(CONTROL_IDS.map(id => {
            const element = $(id);
            return [id, element.type === 'checkbox' ? element.checked : element.valueAsNumber];
        })),
        wave: waveIndex,
        bpm: metronome.getBPM(),
    });
}

function restoreControls(saved = {}) {
    for (const id of CONTROL_IDS) {
        const element = $(id);
        const value = saved[id];
        if (element.type === 'checkbox' && typeof value === 'boolean') element.checked = value;
        if (element.type === 'range' && Number.isFinite(value)) element.value = value;
    }
}

// The last take, recorded or edited; a new recording replaces it.
function saveTake() {
    saveJSON(TAKE_KEY, { notes: arrangement.getNotes(), duration: arrangement.duration });
}

function restoreTake() {
    const take = loadJSON(TAKE_KEY, null);
    const playable = new Set(playableNotes);
    const notes = (Array.isArray(take?.notes) ? take.notes : [])
        .filter(n => playable.has(n?.note) && Number.isFinite(n.time) && Number.isFinite(n.duration)
            && n.time >= 0 && n.duration >= 0)
        .map(({ note, time, duration }) => ({ note, time, duration }));
    if (notes.length > 0) arrangement.load(notes, Number.isFinite(take.duration) ? take.duration : 0);
}

const metronome = new Metronome(audioContext, {
    bpmDisplay: $('bpm-display'),
    tapButton: $('tap-button'),
    metronomeButton: $('metronome-button'),
    onBpmChange: bpm => {
        arrangementView.setBpm(bpm);
        saveSettings();
    },
});

new Keyboard(piano, {
    onNoteOn: note => {
        synth.noteOn(note, noteFrequencies[note]);
        if (recorder.noteOn(note)) arrangementView.render();
    },
    onNoteOff: note => {
        synth.noteOff(note);
        if (recorder.noteOff(note)) arrangementView.render();
    },
});

// ── Panel controls ───────────────────────────────────────────────────────────

restoreControls(settings.controls);

// Apply the control's current value now and on every change; save once it settles
// ('change' fires when a fader is released).
const bind = (id, eventName, apply) => {
    const element = $(id);
    apply(element);
    element.addEventListener(eventName, () => apply(element));
    element.addEventListener('change', saveSettings);
};

bind('volume-toggle', 'change', el => synth.setMuted(!el.checked));
bind('volume-fader', 'input', el => synth.setVolume(el.valueAsNumber / 100));
bind('delay-toggle', 'change', el => synth.enableDelay(el.checked));
bind('delay-fader', 'input', el => synth.setDelayTime(el.valueAsNumber / 100));
bind('reverb-toggle', 'change', el => synth.enableReverb(el.checked));
bind('reverb-fader', 'input', el => synth.setReverbTime(el.valueAsNumber));
bind('chorus-toggle', 'change', el => synth.enableChorus(el.checked));
bind('chorus-fader', 'input', el => synth.setChorusAmount(el.valueAsNumber / 100));

const waveIcon = document.querySelector('.wave-icon');
const waveName = document.querySelector('.wave-name');
let waveIndex = Number.isInteger(settings.wave) && waveforms[settings.wave] ? settings.wave : 0;

function selectWave(step) {
    waveIndex = (waveIndex + step + waveforms.length) % waveforms.length;
    const wave = waveforms[waveIndex];
    waveIcon.textContent = wave.icon;
    waveName.textContent = wave.name;
    synth.setWaveType(wave.value);
    saveSettings();
}

document.querySelector('.nav-button.left').addEventListener('click', () => selectWave(-1));
document.querySelector('.nav-button.right').addEventListener('click', () => selectWave(1));
selectWave(0);

// ── Transport ────────────────────────────────────────────────────────────────

const recordButton = $('record-button');
const playbackButton = $('playback-button');
const loopButton = $('loop-button');

function setPressed(button, pressed) {
    button.classList.toggle('active', pressed);
    button.setAttribute('aria-pressed', String(pressed));
}

function refreshTransport() {
    const hasNotes = arrangement.getNotes().length > 0;
    setPressed(recordButton, recorder.isRecording);
    setPressed(playbackButton, arrangement.isPlaying);
    setPressed(loopButton, arrangement.isLooping);
    playbackButton.disabled = recorder.isRecording || !hasNotes;
    loopButton.disabled = recorder.isRecording;
    playbackButton.querySelector('.icon').textContent = arrangement.isPlaying ? '■' : '▶';
    playbackButton.querySelector('.label').textContent = arrangement.isPlaying ? 'Stop' : 'Play';
    recordButton.querySelector('.label').textContent = recorder.isRecording ? 'Stop' : 'Rec';

    if (recorder.isRecording) arrangementView.follow(() => recorder.elapsed());
    else if (arrangement.isPlaying) arrangementView.follow(() => arrangement.getPosition());
    else arrangementView.stopFollowing();
}

arrangement.onChange = refreshTransport;

recordButton.addEventListener('click', () => {
    if (recorder.isRecording) {
        recorder.stop();
        arrangement.load(recorder.getNotes(), recorder.getDuration());
    } else {
        recorder.start();
        arrangement.load(recorder.getNotes(), 0);
    }
    arrangementView.render();
    refreshTransport();
});

playbackButton.addEventListener('click', () => {
    if (arrangement.isPlaying) arrangement.stop();
    else arrangement.play();
});

loopButton.addEventListener('click', () => {
    arrangement.setLooping(!arrangement.isLooping);
    if (arrangement.isLooping && !arrangement.isPlaying) arrangement.play();
});

if (Number.isFinite(settings.bpm)) metronome.setBPM(settings.bpm);
settingsRestored = true;

restoreTake();
arrangement.onNotesChange = () => {
    if (!recorder.isRecording) saveTake(); // a take in progress is saved when it stops
};

fitRotatedPanel(document.querySelector('.piano-stage'), document.querySelector('.piano-container'));
arrangementView.render();
refreshTransport();
visualizer.start();
