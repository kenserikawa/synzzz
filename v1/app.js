class Synth {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.oscillator = null; // Current oscillator node (if any)
        this.gainNode = null; // Current gain node (if any)
        this.delayNode = null; // Delay effect node
        this.reverbNode = null; // Reverb effect node
        this.chorusNode = null; // Chorus effect node
        this.lfo = null; // LFO for chorus
        this.analyser = audioContext.createAnalyser(); //Analysers here
        this.eqAnalyser = audioContext.createAnalyser(); //Analysers here

        this.currentWaveType = 'sine';
        this.currentDelayTime = 0.3;
        this.currentReverbTime = 1;

        this.attackTime = 0.12;
        this.decayTime = 2;
        this.sustainLevel = 7;
        this.releaseTime = 2;

        this.eqAnalyser.fftSize = 256;

        this.connectSource = function(source) {
            source.connect(this.analyser);
            source.connect(this.eqAnalyser);
        }

        // Initial Effect Nodes
        //this.createDelayNode();
        //this.createReverbNode();
        //this.createChorusNode();
    }

    playNote(frequency) {
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        const rampValue = 0.001;

        this.oscillator.type = this.currentWaveType;
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        this.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(rampValue, this.audioContext.currentTime + 1);
        this.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + this.attackTime);
        this.gainNode.gain.exponentialRampToValueAtTime(this.sustainLevel, this.audioContext.currentTime + this.attackTime + this.decayTime);

        this.oscillator.connect(this.analyser);
        this.oscillator.connect(this.gainNode);

        let currentNode = this.gainNode;

        if (this.chorusNode) {
            currentNode.connect(this.chorusNode);
            currentNode = this.chorusNode;
        }

        if (this.delayNode) {
            currentNode.connect(this.delayNode);
            currentNode = this.delayNode;
        }

        if (this.reverbNode) {
            currentNode.connect(this.reverbNode);
            this.reverbNode.connect(this.audioContext.destination);
        } else {
            currentNode.connect(this.audioContext.destination);
        }

        this.oscillator.start();
        this.oscillator.stop(this.audioContext.currentTime + 1);
        this.oscillator.stop(this.audioContext.currentTime + this.attackTime + this.decayTime + this.releaseTime);

        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(rampValue, this.audioContext.currentTime + this.releaseTime);
    }

    stopNote() {
        // Implementation depends on how you want to stop the note
        // (e.g., gradual fade-out, immediate stop)
    }

    setWaveType(type) {
        this.currentWaveType = type;
    }

    setDelayTime(time) {
        this.currentDelayTime = time;
        if (this.delayNode) {
            this.delayNode.delayTime.value = this.currentDelayTime;
        }
    }

    setReverbTime(time) {
        this.currentReverbTime = time;
        this.createReverbNode(); // Recreate the reverb node with the new time
    }

    enableDelay(enabled) {
        if (enabled && !this.delayNode) {
            this.createDelayNode();
        } else if (!enabled && this.delayNode) {
            this.delayNode.disconnect();
            this.delayNode = null;
        }
    }

    enableReverb(enabled) {
        if (enabled && !this.reverbNode) {
            this.createReverbNode();
        } else if (!enabled && this.reverbNode) {
            this.reverbNode.disconnect();
            this.reverbNode = null;
        }
    }

    enableChorus(enabled) {
        if (enabled && !this.chorusNode) {
            this.createChorusNode();
        } else if (!enabled && this.chorusNode) {
            this.chorusNode.disconnect();
            this.chorusNode = null;
            if (this.lfo) {
                this.lfo.stop();
                this.lfo.disconnect();
                this.lfo = null;
            }
        }
    }

    createChorusNode() {
        this.chorusNode = this.audioContext.createDelay();
        this.chorusNode.delayTime.value = 0.03; // 30ms delay

        this.lfo = this.audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 1;

        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 0.32;

        this.lfo.connect(lfoGain);
        lfoGain.connect(this.chorusNode.delayTime);
        this.lfo.start();

        return this.chorusNode;
    }

    createDelayNode() {
        this.delayNode = this.audioContext.createDelay(5.0);
        this.delayNode.delayTime.value = this.currentDelayTime; // 0.1 to 0.8?

        const feedbackNode = this.audioContext.createGain();
        feedbackNode.gain.value = 0.4;

        this.delayNode.connect(feedbackNode);
        feedbackNode.connect(this.delayNode);

        return this.delayNode;
    }

    async createReverbNode() {
        this.reverbNode = this.audioContext.createConvolver();

        // Generate a simple impulse response (white noise decay)
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * this.currentReverbTime;
        const impulseBuffer = this.audioContext.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < impulseBuffer.numberOfChannels; channel++) {
            const channelData = impulseBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * (1 - i / length); // White noise decay
            }
        }

        this.reverbNode.buffer = impulseBuffer;
        return this.reverbNode;
    }
}
class Keyboard {
    constructor(synth, noteFrequencies) {
        this.synth = synth;
        this.noteFrequencies = noteFrequencies; // Frequencies must be passed down
        this.keys = document.querySelectorAll('.key'); // Select keys in the constructor
        this.isMouseDown = false;
        this.triggeredKeys = new Set(); // Track pressed keys

        this.attachEventListeners(); // Call the event listener setup

    }

    attachEventListeners() {
        this.keys.forEach(key => {
            const note = key.getAttribute('data-note');

            key.addEventListener('mousedown', () => {
                const frequency = this.noteFrequencies[note];
                this.synth.playNote(frequency);
                key.classList.add('active');
            });

            key.addEventListener('mouseup', () => {
                key.classList.remove('active');
            });

            key.addEventListener('mouseleave', () => {
                key.classList.remove('active');
            });

            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const frequency = this.noteFrequencies[note];
                this.synth.playNote(frequency);
                key.classList.add('active');
            });

            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                key.classList.remove('active');
            });

            key.addEventListener('mousedown', () => {
                this.isMouseDown = true;
                this.triggeredKeys.clear(); // Clear previously triggered keys
                if (!this.triggeredKeys.has(note)) {
                    this.synth.playNote(this.noteFrequencies[note]);
                    this.triggeredKeys.add(note);
                    key.classList.add('active');
                }
            });

            // Trigger note on hover while holding mouse down
            key.addEventListener('mouseenter', () => {
                if (this.isMouseDown && !this.triggeredKeys.has(note)) {
                    this.synth.playNote(this.noteFrequencies[note]);
                    this.triggeredKeys.add(note);
                    key.classList.add('active');
                }
            });
        });

        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            this.triggeredKeys.clear(); // Reset triggered keys when mouse is released
        });

        document.addEventListener('mousedown', () => {
            this.isMouseDown = true;
        });
    }
    handleKeyDown(event) {
        // Implementation depends on how you want to handle key down events
        // (e.g., trigger playNote based on key code)
    }

    handleKeyUp(event) {
        // Implementation depends on how you want to handle key up events
        // (e.g., trigger stopNote based on key code)
    }

    highlightKey(note) {
        // Implementation depends on how you want to highlight the key
        // (e.g., add a CSS class to the key element)
    }

    unhighlightKey(note) {
        // Implementation depends on how you want to unhighlight the key
        // (e.g., remove the CSS class from the key element)
    }
}

class Arrangement {
    constructor(audioContext, noteFrequencies) {
        this.audioContext = audioContext;
        this.noteFrequencies = noteFrequencies;
        this.recordedNotes = [];
        this.isRecording = false;
        this.isLooping = false;
        this.loopTimeout = null;
        this.recordingStopTime = null;
        this.startTime = null;
        this.playbackTimeoutIds = [];  //Store timeout IDs so we can clear them when stopping playback

    }

    startRecording() {
        this.recordedNotes = [];
        this.isRecording = true;
        this.startTime = this.audioContext.currentTime;  
    }

    stopRecording() {
        this.isRecording = false;
        this.recordingStopTime = this.audioContext.currentTime;
    }

    addNote(note, time) {
        if (this.isRecording) {
            this.recordedNotes.push({ note: note, time: time });
        }
    }

    removeNote(index) {
        this.recordedNotes.splice(index, 1);
    }

    moveNote(index, newTime) {
        this.recordedNotes[index].time = newTime;
    }
     
    play(playNoteFunction) { 
        if (this.recordedNotes.length === 0) return;
        this.stop(); 
        this.startTime = this.audioContext.currentTime;
        this.playbackTimeoutIds = []; 

        this.recordedNotes.forEach(noteData => {
             const relativeTime = noteData.time - this.startTime;

             const timeoutId = setTimeout(() => {
                const frequency = this.noteFrequencies[noteData.note];
                playNoteFunction(frequency); 
            }, relativeTime * 1000);
            this.playbackTimeoutIds.push(timeoutId);
        });
    }

    stop() {
        // Clear all scheduled notes
        this.playbackTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        this.playbackTimeoutIds = []; //Clear timeout array
    }

    setLooping(looping, playNoteFunction) {
        this.isLooping = looping;
        if (looping) {
            this.startLoop(playNoteFunction);
        } else {
            this.stopLoop();
        }
    }

    startLoop(playNoteFunction) {
        if (this.recordedNotes.length === 0) return;

        const loop = () => {
            this.play(playNoteFunction);  // Play the notes

            this.loopTimeout = setTimeout(() => { // Setup to loop again
                if (this.isLooping) { // check if loop is still enabled
                    loop();
                }
            }, (this.recordingStopTime - this.startTime) * 1000);
        };
        loop();  // Initial call
    }

    stopLoop() {
        clearTimeout(this.loopTimeout);
        this.stop();  // Stop existing playback as well
    }

    getNotes() {
        return this.recordedNotes;  // For rendering the arrangement view
    }

    setNotes(notes) {
        this.recordedNotes = notes; //Method to set arrengement notes for drag and drop
    }
}

class ArrangementView {
    constructor(arrangement, arrangementViewElement) {
        this.arrangement = arrangement;
        this.arrangementViewElement = arrangementViewElement;
        this.draggingNote = null;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0; // Store the initial Y offset for row restriction
    }

    render() {
        this.arrangementViewElement.innerHTML = ''; // Clear previous arrangement
        const recordedNotes = this.arrangement.getNotes(); // get the notes array
        if (recordedNotes.length === 0) {
            this.arrangementViewElement.textContent = 'No notes recorded.';
            return;
        }

        // Create Rows
        this.createRows();

        const startTime = recordedNotes[0].time;  // Get the start time of the first note

        recordedNotes.forEach(noteData => {
            const noteElement = document.createElement('div');
            // Create a text string that includes both the note and time
            const noteText = `${noteData.note} (${(noteData.time - startTime).toFixed(2)}s)`;  // Display note and relative time

            noteElement.textContent = noteText;
            noteElement.classList.add('arrangement-note');
            noteElement.setAttribute('data-note', noteData.note);  // Store note for row restriction

            // Calculate the position of the note based on its time relative to the start time
            const relativeTime = noteData.time - startTime;
            noteElement.style.left = (relativeTime * 50) + 'px'; // Adjust the scaling factor (50) as needed
            noteElement.style.top = this.getRowPosition(noteData.note) + 'px';  // Position on correct row

            // Make notes draggable
            noteElement.draggable = true;
            this.arrangementViewElement.appendChild(noteElement);

        });

        // Attach drag events to the arrangement view *after* notes are added
        this.attachDragEvents();
    }

    createRows() {
        const noteRows = {  // Define rows for your notes
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
            'C1': 12, 'C#1': 13, 'D1': 14, 'D#1': 15, 'E1': 16, 'F1': 17, 'F#1': 18, 'G1': 19, 'G#1': 20, 'A1': 21, 'A#1': 22, 'B1': 23,
            'C2': 24, 'C#2': 25, 'D2': 26, 'D#2': 27, 'E2': 28, 'F2': 29 //Up to F2 to avoid overlap
        };
        const rowHeight = 25; // Adjust row height as needed
        for (const note in noteRows) {
            const row = document.createElement('div');
            row.classList.add('arrangement-row');
            row.style.top = this.getRowPosition(note) + 'px';
            row.style.height = rowHeight + 'px';
            this.arrangementViewElement.appendChild(row);
        }
    }

    getRowPosition(note) {
        const noteRows = {  // Define rows for your notes
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
            'C1': 12, 'C#1': 13, 'D1': 14, 'D#1': 15, 'E1': 16, 'F1': 17, 'F#1': 18, 'G1': 19, 'G#1': 20, 'A1': 21, 'A#1': 22, 'B1': 23,
            'C2': 24, 'C#2': 25, 'D2': 26, 'D#2': 27, 'E2': 28, 'F2': 29 //Up to F2 to avoid overlap
        };

        const rowHeight = 25; // Adjust row height as needed
        return (noteRows[note] || 0) * rowHeight; // Default to the first row if note is not found
    }
    
    attachDragEvents() {
        const notes = this.arrangementViewElement.querySelectorAll('.arrangement-note');

        notes.forEach(note => {
            note.addEventListener('mousedown', (e) => {
                this.draggingNote = note;
                this.dragStartOffsetX = e.clientX - note.offsetLeft;
                this.dragStartOffsetY = e.clientY - note.offsetTop;  // Get Y Offset
                note.classList.add('dragging');
            });
        });
    }

    handleDrag(event) {
        if (this.draggingNote) {
            const newLeft = event.clientX - this.dragStartOffsetX;
            const initialTop = this.getRowPosition(this.draggingNote.dataset.note);
            this.draggingNote.style.left = newLeft + 'px';
            this.draggingNote.style.top = initialTop + 'px'; // Keep on the original row
        }
    }

    handleDragEnd() {
        if (this.draggingNote) {
            this.draggingNote.classList.remove('dragging');
            this.draggingNote = null;
        }
    }
}

class Visualizer {
    constructor(audioContext, waveformCanvas, eqCanvas) {
        this.audioContext = audioContext;
        this.waveformCanvas = waveformCanvas;
        this.eqCanvas = eqCanvas;
        this.waveformContext = waveformCanvas.getContext("2d");
        this.eqContext = eqCanvas.getContext("2d");

        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        this.eqAnalyser = audioContext.createAnalyser();
        this.eqAnalyser.fftSize = 256;

        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        this.eqBufferLength = this.eqAnalyser.frequencyBinCount;
        this.eqDataArray = new Uint8Array(this.eqBufferLength);
    }

    drawWaveform() {
        this.waveformContext.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
        this.analyser.getByteTimeDomainData(this.dataArray);

        this.waveformContext.lineWidth = 2;
        this.waveformContext.strokeStyle = "rgb(252, 18, 96, 0.8)";

        this.waveformContext.beginPath();

        const sliceWidth = (this.waveformCanvas.width * 1.0) / this.bufferLength;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = (v * this.waveformCanvas.height) / 2;

            if (i === 0) {
                this.waveformContext.moveTo(x, y);
            } else {
                this.waveformContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.waveformContext.lineTo(this.waveformCanvas.width, this.waveformCanvas.height / 2);
        this.waveformContext.stroke();

        requestAnimationFrame(() => this.drawWaveform()); // Use arrow function to preserve 'this'
    }

    drawEQ() {
        this.eqAnalyser.getByteFrequencyData(this.eqDataArray);
        this.eqContext.clearRect(0, 0, this.eqCanvas.width, this.eqCanvas.height);

        const barWidth = (this.eqCanvas.width / this.eqBufferLength) * 2.5;
        let barHeight = 0;
        let x = 0;

        for (let i = 0; i < this.eqBufferLength; i++) {
            barHeight = Math.max(0, this.eqDataArray[i] - 10); // Decay

            this.eqContext.fillStyle = 'rgb(' + (barHeight + 100) + ',50, 196)';
            this.eqContext.fillRect(x, this.eqCanvas.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }

        requestAnimationFrame(() => this.drawEQ()); // Use arrow function to preserve 'this'
    }

    connectSource(source) {
        source.connect(this.analyser);
        source.connect(this.eqAnalyser);
    }
}
 
class Metronome {
    constructor(audioContext, bpmDisplay, tapButton, metronomeButton) {
        this.audioContext = audioContext;
        this.bpmDisplay = bpmDisplay;
        this.tapButton = tapButton;
        this.metronomeButton = metronomeButton
        this.taps = [];
        this.lastTapTime = 0;
        this.isMetronomeOn = false;
        this.metronomeInterval = null;
        this.beatsPerMinute = 120;
        this.secondsPerBeat = 60 / this.beatsPerMinute;
        this.pixelsPerSecond = 50;

        this.oscillator = null
        this.gainNode = null;

        this.setupEventListeners(); //Initializes the Listeners
    }

    setupEventListeners() {

        this.tapButton.addEventListener('click', () => this.calculateBPM());

        //Metronome event listener
        this.metronomeButton.addEventListener('click', () => {
            this.toggleMetronome();
        });
    }

    calculateBPM() {
        const now = Date.now();
        if (now - this.lastTapTime > 2000) {
            this.taps = [];
        }
        this.taps.push(now);
        this.lastTapTime = now;

        if (this.taps.length > 4) {
            this.taps = this.taps.slice(-4);
        }

        if (this.taps.length > 1) {
            const intervals = [];
            for (let i = 1; i < this.taps.length; i++) {
                intervals.push(this.taps[i] - this.taps[i - 1]);
            }
            const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            this.beatsPerMinute = Math.round(60000 / averageInterval);
            this.updateBPMDisplay();
        }
    }

    updateBPMDisplay() {
        this.bpmDisplay.textContent = `${this.beatsPerMinute} BPM`;
    }

    toggleMetronome() {
        this.isMetronomeOn = !this.isMetronomeOn;
        if (this.isMetronomeOn) {
            this.startMetronome();
        } else {
            this.stopMetronome();
        }
    }

    startMetronome() {
        if (this.metronomeInterval) {
            clearInterval(this.metronomeInterval);
        }

        this.metronomeInterval = setInterval(() => {
            this.playTick();
        }, 60000 / this.beatsPerMinute);
        this.playTick()
    }

    stopMetronome() {
        clearInterval(this.metronomeInterval);
        this.metronomeInterval = null;
    }

    playTick() {
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();

        this.oscillator.type = 'sine'; // Use a sine wave for the tick
        this.oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime); // A higher frequency

        this.gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);  // Slightly louder
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        this.oscillator.start();
        this.oscillator.stop(this.audioContext.currentTime + 0.1); // Shorter duration
    }

    getBPM() {
        return this.beatsPerMinute;
    }

    setBPM(bpm) {
        this.beatsPerMinute = bpm;
        this.updateBPMDisplay();
        if (this.isMetronomeOn) {
            this.stopMetronome();
            this.startMetronome();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize AudioContext
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Define note frequencies
    const noteFrequencies = {
        // Low octave
        'C': 130.81, 'C#': 138.59, 'D': 146.83, 'D#': 155.56,
        'E': 164.81, 'F': 174.61, 'F#': 185.00, 'G': 196.00,
        'G#': 207.65, 'A': 220.00, 'A#': 233.08, 'B': 246.94,
        // Medium octave
        'C1': 261.63, 'C#1': 277.18, 'D1': 293.66, 'D#1': 311.13,
        'E1': 329.63, 'F1': 349.23, 'F#1': 369.99, 'G1': 392.00,
        'G#1': 415.30, 'A1': 440.00, 'A#1': 466.16, 'B1': 493.88,
        // High octave
        'C2': 523.25, 'C#2': 554.37, 'D2': 587.33, 'D#2': 622.25,
        'E2': 659.25, 'F2': 698.46, 'F#2': 739.99, 'G2': 783.99,
        'G#2': 830.61, 'A2': 880.00, 'A#2': 932.33, 'B2': 987.77
    };

    // Get DOM Elements
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
    let currentWaveType = 'sine';
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
        display.innerHTML = `
            <span class="wave-icon">${currentWave.icon}</span>
        `;
    }

    leftButton.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + waveforms.length) % waveforms.length;
        updateDisplay();
    });

    rightButton.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % waveforms.length;
        updateDisplay();
    });

    // Instantiate the Synth
    const synth = new Synth(audioContext);

    // Instantiate the Visualizer
    const visualizer = new Visualizer(audioContext, waveformCanvas, eqCanvas, synth.analyser, synth.eqAnalyser);

    // Connect the source to the visualizer
    visualizer.connectSource(synth.analyser);
    visualizer.connectSource(synth.eqAnalyser);

    //Start visualizations
    visualizer.drawWaveform();
    visualizer.drawEQ();

    // Instantiate the Keyboard
    const keyboard = new Keyboard(synth, noteFrequencies);

    // Instantiate the Arrangement
    const arrangement = new Arrangement(audioContext, noteFrequencies);

    // Instantiate the ArrangementView
    const arrangementView = new ArrangementView(arrangement, arrangementViewElement, noteFrequencies);

    // Instantiate the Metronome
    const metronome = new Metronome(audioContext, bpmDisplay, tapButton, metronomeButton);


    // Effect Faders
    delayFader.addEventListener('input', (event) => {
        synth.setDelayTime(event.target.value / 100);
    });

    reverbFader.addEventListener('input', (event) => {
        synth.setReverbTime(event.target.value);
    });

    // Effect Toggles
    delayToggle.addEventListener('change', () => {
        synth.enableDelay(delayToggle.checked);
    });

    reverbToggle.addEventListener('change', () => {
        synth.enableReverb(reverbToggle.checked);
    });

    chorusToggle.addEventListener('change', () => {
        synth.enableChorus(chorusToggle.checked);
    });

    function updateDisplay() {
        const currentWave = waveforms[currentIndex];
        currentWaveType = currentWave.value;
        display.innerHTML = `
            <span class="wave-icon">${currentWave.icon}</span>
        `;
        currentWaveType = currentWave.value;

    }
    
    leftButton.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + waveforms.length) % waveforms.length;
        updateDisplay();
    });
    
    rightButton.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % waveforms.length;
        updateDisplay();
    });
    
    let currentDelayTime = 0.3;
    delayFader.addEventListener('input', (event) => {
        currentDelayTime = event.target.value / 100;
        createDelayNode(); 
    });
    
    let currentReverbTime = 1;        
    reverbFader.addEventListener('input', (event) => {
        currentReverbTime = event.target.value;
        createReverbNode();
    });
     
    let delayNode = null;
    let convolverNode = null;
    let chorusNode = null;
    let lfo = null;
    
    const attackTime = 0.12;
    const decayTime = 2;
    const sustainLevel = 7;
    const releaseTime = 2;
    
    const waveformContext = waveformCanvas.getContext("2d");
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let isMouseDown = false;
    let triggeredKeys = new Set();
    
    // OSCILLATOR VIEWER ...
    function drawWaveform() {
        waveformContext.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        analyser.getByteTimeDomainData(dataArray);
    
        waveformContext.lineWidth = 2;
        waveformContext.strokeStyle = "rgb(252, 50, 196)";
    
        waveformContext.beginPath();
    
        const sliceWidth = (waveformCanvas.width * 1.0) / bufferLength;
        let x = 0;
    
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * waveformCanvas.height) / 2;
    
            if (i === 0) {
              waveformContext.moveTo(x, y);
            } else {
              waveformContext.lineTo(x, y);
            }
    
            x += sliceWidth;
        }
    
        waveformContext.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
        waveformContext.stroke();
    
        requestAnimationFrame(drawWaveform);
    }
    function drawEQ() {
        eqAnalyser.getByteFrequencyData(eqDataArray);
    
        eqContext.clearRect(0, 0, eqCanvas.width, eqCanvas.height);
    
        const barWidth = (eqCanvas.width / eqBufferLength) * 2.5;
        let barHeight = 0;
        let x = 0;
    
        for (let i = 0; i < eqBufferLength; i++) {
            barHeight = Math.max(0, eqDataArray[i] - 10); // Decay
    
            eqContext.fillStyle = 'rgb(' + (barHeight + 100) + ',50, 196)';
            eqContext.fillRect(x, eqCanvas.height - barHeight / 2, barWidth, barHeight / 2);
    
            x += barWidth + 1;
        }
    
        requestAnimationFrame(drawEQ);
    }
        
    function createChorusNode() {
        chorusNode = audioContext.createDelay();
        chorusNode.delayTime.value = 0.03; // 30ms delay
    
        lfo = audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 1;
    
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = 0.32;
    
        lfo.connect(lfoGain);
        lfoGain.connect(chorusNode.delayTime);
        lfo.start();
    
        return chorusNode;
    }
    
    function createDelayNode() {
        delayNode = audioContext.createDelay(5.0);
        delayNode.delayTime.value = currentDelayTime; // 0.1 to 0.8?
    
        const feedbackNode = audioContext.createGain();
        feedbackNode.gain.value = 0.4; 
    
        delayNode.connect(feedbackNode);
        delayNode.connect(delayNode);
    
        return delayNode;
    }
    
    async function createReverbNode() {
        convolverNode = audioContext.createConvolver();
    
        // Generate a simple impulse response (white noise decay)
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * currentReverbTime; 
        const impulseBuffer = audioContext.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < impulseBuffer.numberOfChannels; channel++) {
            const channelData = impulseBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * (1 - i / length); // White noise decay
            }
        }
    
        convolverNode.buffer = impulseBuffer;
        return convolverNode;
    }
    
    function highlghtAnimation() {
      let elements = document.getElementsByClassName('oscillator-wave-viewer');
    
      for (let i = 0; i < elements.length; i++) {
          let element = elements[i];
          element.style.borderTop = "3px solid rgb(60, 0, 0)";
          setTimeout(() => {
              element.style.borderTop = "3px solid rgb(40, 0, 0)";
          }, 4200);
      }
    }
    
    function playNote(frequency) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const rampValue = 0.001;
        oscillator.type = currentWaveType;
    
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(rampValue, audioContext.currentTime + 1);
        gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel,audioContext.currentTime + attackTime + decayTime);
    
        oscillator.connect(analyser);
        oscillator.connect(gainNode);
    
        let currentNode = gainNode;
    
        if (chorusToggle.checked && !chorusNode) {
            chorusNode = createChorusNode();
        }
    
        if (chorusToggle.checked) {
            currentNode.connect(chorusNode);
            currentNode = chorusNode;
        }
    
        if (delayToggle.checked && !delayNode) {
            delayNode = createDelayNode();
        }
    
        if (reverbToggle.checked && !convolverNode) {
            createReverbNode().then(() => {
                if (delayToggle.checked) {
                    gainNode.connect(delayNode);
                    delayNode.connect(convolverNode);
                    convolverNode.connect(audioContext.destination);
                } else {
                    gainNode.connect(convolverNode);
                    convolverNode.connect(audioContext.destination);
                }
            });
        } else if (reverbToggle.checked) {
            if (delayToggle.checked) {
                gainNode.connect(delayNode);
                delayNode.connect(convolverNode);
                convolverNode.connect(audioContext.destination);
            } else {
                gainNode.connect(convolverNode);
                convolverNode.connect(audioContext.destination);
            }
        } else if (delayToggle.checked) {
            gainNode.connect(delayNode);
            delayNode.connect(audioContext.destination);
        } else {
            gainNode.connect(audioContext.destination);
        }
    
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1);
    
        oscillator.stop(audioContext.currentTime + attackTime + decayTime + releaseTime);
    
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(rampValue, audioContext.currentTime + releaseTime);
    
        highlghtAnimation();
        drawWaveform()
    }
    
    keys.forEach(key => {
        const note = key.getAttribute('data-note');
        key.addEventListener('mousedown', () => {
            const frequency = noteFrequencies[note];
            playNote(frequency);
            key.classList.add('active');
        });
    
        key.addEventListener('mouseup', () => {
            key.classList.remove('active');
        });
    
        key.addEventListener('mouseleave', () => {
            key.classList.remove('active');
        });
    
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const note = key.getAttribute('data-note');
            const frequency = noteFrequencies[note];
            playNote(frequency);
            key.classList.add('active');
        });
    
        key.addEventListener('touchend', (e) => {
            e.preventDefault();
            key.classList.remove('active');
        });
        
        key.addEventListener('mousedown', () => {
            isMouseDown = true;
            triggeredKeys.clear(); // Clear previously triggered keys
            if (!triggeredKeys.has(note)) {
                playNote(noteFrequencies[note]);
                triggeredKeys.add(note);
                key.classList.add('active');
            }
        });
      
          // Trigger note on hover while holding mouse down
        key.addEventListener('mouseenter', () => {
            if (isMouseDown && !triggeredKeys.has(note)) {
                playNote(noteFrequencies[note]);
                triggeredKeys.add(note);
                key.classList.add('active');
            }
        });
    });           
    
    document.addEventListener('mouseup', () => {
        isMouseDown = false;
        triggeredKeys.clear(); // Reset triggered keys when mouse is released
    });
    
    document.addEventListener('mousedown', () => {
        isMouseDown = true;
    });
    
    // FX
    delayToggle.addEventListener('change', () => {
        if (!delayToggle.checked && delayNode) {
          delayNode.disconnect();
          delayNode = null;
        }
    });
    
    reverbToggle.addEventListener('change', () => {
        if (!reverbToggle.checked && convolverNode) {
          convolverNode.disconnect();
          convolverNode = null;
        }
    });
    
    chorusToggle.addEventListener('change', () => {
        if (!chorusToggle.checked && chorusNode) {
          chorusNode.disconnect();
          chorusNode = null;
          if (lfo) {
            lfo.stop();
            lfo.disconnect();
            lfo = null;
          }
        }
    });
    
    drawWaveform();
    
});