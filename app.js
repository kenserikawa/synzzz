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
const arrangementView = new ArrangementView(arrangement, $('arrangement-view'), playableNotes);
const visualizer = new Visualizer(synth.analyser, $('waveformCanvas'), $('eqCanvas'));

new Metronome(audioContext, {
    bpmDisplay: $('bpm-display'),
    tapButton: $('tap-button'),
    metronomeButton: $('metronome-button'),
    onBpmChange: bpm => arrangementView.setBpm(bpm),
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

// Apply the control's current value now (browsers restore form state on reload) and on every change.
const bind = (id, eventName, apply) => {
    const element = $(id);
    apply(element);
    element.addEventListener(eventName, () => apply(element));
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
let waveIndex = 0;

function selectWave(step) {
    waveIndex = (waveIndex + step + waveforms.length) % waveforms.length;
    const wave = waveforms[waveIndex];
    waveIcon.textContent = wave.icon;
    waveName.textContent = wave.name;
    synth.setWaveType(wave.value);
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

fitRotatedPanel(document.querySelector('.piano-stage'), document.querySelector('.piano-container'));
arrangementView.render();
refreshTransport();
visualizer.start();
