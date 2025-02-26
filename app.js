import ArrangementView  from "./component/arrangement-view.js";
import Arrangement  from "./component/arrangement.js";
import Recorder from "./component/recorder.js";
import Keyboard  from "./component/keyboard.js";
import Metronome  from "./component/metronome.js";
import Synth  from "./component/synth.js";
import Visualizer  from "./component/visualizer.js";

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

document.addEventListener('DOMContentLoaded', () => {

    const noteFrequencies = {
        'C': 130.81, 'C#': 138.59, 'D': 146.83, 'D#': 155.56,
        'E': 164.81, 'F': 174.61, 'F#': 185.00, 'G': 196.00,
        'G#': 207.65, 'A': 220.00, 'A#': 233.08, 'B': 246.94,

        'C1': 261.63, 'C#1': 277.18, 'D1': 293.66, 'D#1': 311.13,
        'E1': 329.63, 'F1': 349.23, 'F#1': 369.99, 'G1': 392.00,
        'G#1': 415.30, 'A1': 440.00, 'A#1': 466.16, 'B1': 493.88,

        'C2': 523.25, 'C#2': 554.37, 'D2': 587.33, 'D#2': 622.25,
        'E2': 659.25, 'F2': 698.46, 'F#2': 739.99, 'G2': 783.99,
        'G#2': 830.61, 'A2': 880.00, 'A#2': 932.33, 'B2': 987.77
    };

    const waveformCanvas = document.getElementById("waveformCanvas");
    const eqCanvas = document.getElementById("eqCanvas");
    const keys = document.querySelectorAll('.key');
    const delayFader = document.getElementById('delay-fader');
    const reverbFader = document.getElementById('reverb-fader');
    const chorusFader = document.getElementById('chorus-fader');
    const delayToggle = document.getElementById('delay-toggle');
    const reverbToggle = document.getElementById('reverb-toggle');
    const chorusToggle = document.getElementById('chorus-toggle');
    const recordButton = document.getElementById('record-button');
    const arrangementViewElement = document.getElementById('arrangement-view');
    const playbackButton = document.getElementById('playback-button');
    const loopButton = document.getElementById('loop-button');
    const bpmDisplay = document.getElementById('bpm-display');
    const tapButton = document.getElementById('tap-button');
    const metronomeButton = document.getElementById('metronome-button');

    const synth = new Synth(audioContext);
    const visualizer = new Visualizer(audioContext, waveformCanvas, eqCanvas);
    const recorder = new Recorder(audioContext);

    visualizer.connectSource(synth.analyser);
    visualizer.connectSource(synth.eqAnalyser);
    visualizer.drawWaveform();
    visualizer.drawEQ();

    const keyboard = new Keyboard(synth, noteFrequencies, keys);
    const arrangement = new Arrangement(audioContext, noteFrequencies);
    const arrangementView = new ArrangementView(arrangement, arrangementViewElement);
    const metronome = new Metronome(audioContext, bpmDisplay, tapButton, metronomeButton);
    
    arrangement.arrangementView = arrangementView;


    delayFader.addEventListener('input', (event) => {
        synth.setDelayTime(event.target.value / 100);
    });

    reverbFader.addEventListener('input', (event) => {
        synth.setReverbTime(event.target.value);
    });

    chorusFader.addEventListener('input', (event) => {
        synth.setChorusTime(event.target.value);
    });

    delayToggle.addEventListener('change', () => {
        synth.enableDelay(delayToggle.checked);
    });

    reverbToggle.addEventListener('change', () => {
        synth.enableReverb(reverbToggle.checked);
    });

    chorusToggle.addEventListener('change', () => {
        synth.enableChorus(chorusToggle.checked);
    });

    recordButton.addEventListener('click', () => {
        if (!recorder.isRecording) {
            recorder.start();
            recordButton.textContent = 'Stop Recording';
            playbackButton.disabled = true;
            loopButton.disabled = true;
        } else {
            recorder.stop();
            recordButton.textContent = '';
            playbackButton.disabled = false;
            loopButton.disabled = false;
        }
        arrangementView.render();
    });

    playbackButton.addEventListener('click', () => {
        arrangement.play(synth.playNote.bind(synth));
    });

    loopButton.addEventListener('click', () => {
        arrangement.setLooping(!arrangement.isLooping, synth.playNote.bind(synth));
    });

    const waveforms = [
        { icon: '∿', name: 'Sine', value: 'sine' },
        { icon: '▇', name: 'Square', value: 'square' },
        { icon: '◺', name: 'Triangle', value: 'triangle' },
        { icon: '◿', name: 'Sawtooth', value: 'sawtooth' }
    ];

    let currentIndex = 0;
    const display = document.querySelector('.display');
    const leftButton = document.querySelector('.left');
    const rightButton = document.querySelector('.right');

    function updateDisplay() {
        const currentWave = waveforms[currentIndex];
        display.innerHTML = `<span class="wave-icon">${currentWave.icon}</span>`;
        synth.setWaveType(currentWave.value);
    }

    function findElementByDataNote(note) {
        return document.querySelector(`[data-note="${note}"]`);
    }

    leftButton.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + waveforms.length) % waveforms.length;
        updateDisplay();
    });

    rightButton.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % waveforms.length;
        updateDisplay();
    });

    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        let note = keyboard.findKeyNote(key);
        if (note) {
            const keyElement = findElementByDataNote(note);
            keyElement.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        let note = keyboard.findKeyNote(key);

        if (note) {
            console.log(`Playing note: ${note}`);
            synth.playNote(noteFrequencies[note]);
            const keyElement = findElementByDataNote(note);
            keyElement.classList.add('active');

            if (recorder.isRecording) {
                recorder.addNote(note, audioContext.currentTime);
                arrangementView.render();
            }
        }
    });

    updateDisplay();
    arrangementView.render();
});