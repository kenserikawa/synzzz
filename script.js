function log(message) {
    const logDiv = document.getElementById('action-log'); 
    
    const logEntry = document.createElement('div');
    logEntry.textContent = logEntry.textContent + "\n" + message;
    logDiv.appendChild(logEntry);
    logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll to bottom
}


document.addEventListener('DOMContentLoaded', () => {

    var audioContext;

    function initializeAudioContext() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        //log('AudioContext initialized');
    }

    initializeAudioContext();

    const noteRows = { 
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
        'C1': 12, 'C#1': 13, 'D1': 14, 'D#1': 15, 'E1': 16, 'F1': 17, 'F#1': 18, 'G1': 19, 'G#1': 20, 'A1': 21, 'A#1': 22, 'B1': 23,
        'C2': 24, 'C#2': 25, 'D2': 26, 'D#2': 27, 'E2': 28, 'F2': 29 , 'F#2': 30, 'G2': 31,
        'G#2': 32, 'A2': 33, 'A#2': 34, 'B2': 35
    };

    const bpmDisplay = document.getElementById('bpm-display');
    const tapButton = document.getElementById('tap-button');
    const metronomeButton = document.getElementById('metronome-button');
    
    let taps = [];
    let lastTapTime = 0;
    let isMetronomeOn = false;
    let metronomeInterval;
    let beatsPerMinute = 120;
    const secondsPerBeat = 60 / beatsPerMinute;
    const pixelsPerSecond = 50; 


    const clickSound = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=');

    function calculateBPM() {
        const now = Date.now();
        if (now - lastTapTime > 2000) {
            taps = [];
        }
        taps.push(now);
        lastTapTime = now;

        if (taps.length > 4) {
            taps = taps.slice(-4);
        }

       if (taps.length > 1) {
            const intervals = [];
            for (let i = 1; i < taps.length; i++) {
                intervals.push(taps[i] - taps[i-1]);
            }
            const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            beatsPerMinute = Math.round(60000 / averageInterval);
            updateBPMDisplay();
        }
    }

    tapButton.addEventListener('click', calculateBPM);
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            calculateBPM();
        }
    });

    const keys = document.querySelectorAll('.key');
    const delayFader = document.getElementById('delay-fader');
    const reverbFader = document.getElementById('reverb-fader');
    const chorusFader = document.getElementById('chorus-fader');


    let currentWaveType = 'sine';

    const waveforms = [
        { icon: '∿', name: 'Sine', value: 'sine' },
        { icon: '▇', name: 'Square', value: 'square' },
        { icon: '◺', name: 'Triangle', value: 'triangle' },
        { icon: '◿', name: 'Sawtooth', value: 'sawtooth' }
    ];

    let currentIndex = 0;

    const eqCanvas = document.getElementById("eqCanvas");
    const eqContext = eqCanvas.getContext("2d");
    const eqAnalyser = audioContext.createAnalyser();
    eqAnalyser.fftSize = 2048; // Adjust for desired detail
    const eqBufferLength = eqAnalyser.frequencyBinCount;
    const eqDataArray = new Uint8Array(eqBufferLength);

    let isRecording = false;
    let recordedNotes = [];  // Array to store the recorded notes
    const recordButton = document.getElementById('record-button');
    const arrangementView = document.getElementById('arrangement-view'); // Get the arrangement view element
    const playbackButton = document.getElementById('playback-button');
    const loopButton = document.getElementById('loop-button');
    let isLooping = false; // Flag for looping
    let loopTimeout;
    let recordingStopTime; 

    let draggingNote = null;
    let dragStartOffsetX = 0;
    let dragStartOffsetY = 0;

    const display = document.querySelector('.display');
    const leftButton = document.querySelector('.left');
    const rightButton = document.querySelector('.right');

    function updateDisplay() {
        const currentWave = waveforms[currentIndex];
        currentWaveType = currentWave.value;
        display.innerHTML = `
            <span class="wave-icon">${currentWave.icon}</span>
        `;
        //log('wave: ' + currentWaveType)
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

    let currentChorusTime = 1;        
    chorusFader.addEventListener('input', (event) => {
        currentChorusTime = event.target.value;
        createChorusNode();
    });


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
    
    const delayToggle = document.getElementById('delay-toggle');
    const reverbToggle = document.getElementById('reverb-toggle');
    const chorusToggle = document.getElementById('chorus-toggle');

    let delayNode = null;
    let convolverNode = null;
    let chorusNode = null;
    let lfo = null;

    const attackTime = 1;
    const decayTime = 1;
    const sustainLevel = 1;
    const releaseTime = 1;

    const waveformCanvas = document.getElementById("waveformCanvas");
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
        waveformContext.strokeStyle = "rgb(252, 18, 96, 0.8)";

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
    
        const barWidth = (eqCanvas.width / eqBufferLength) * 25;
        let barHeight = 0;
        let x = 0;

        for (let i = 0; i < eqBufferLength; i++) {
            // Decay the bar height (reduce it slightly each frame)
            barHeight = Math.max(0, eqDataArray[i] - 10); // Adjust the decay amount (10) as needed                                                                                                             
    
            eqContext.fillStyle = 'rgb('+ (barHeight + 100) + ',50, 196)';
            eqContext.fillRect(x, eqCanvas.height - barHeight / 6, barWidth, barHeight / 2);
    
            x += barWidth +1;
        }
    
        requestAnimationFrame(drawEQ);
    }

    function createChorusNode() {
        chorusNode = audioContext.createDelay();
        chorusNode.delayTime.value = currentChorusTime; // 30ms delay
    
        lfo = audioContext.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 0.2;
    
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = 10;
    
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
        feedbackNode.connect(delayNode);
        //log('delay node created')
    
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
        //log('reverb node created')
        
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

        //log('Frequency: ' + frequency)

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(rampValue, audioContext.currentTime + 1);
        gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel,audioContext.currentTime + attackTime + decayTime);

        oscillator.connect(analyser);
        oscillator.connect(gainNode);
        oscillator.connect(eqAnalyser)

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

            if (isRecording) {
                recordedNotes.push({ note: note, time: audioContext.currentTime }); // Store the note and its start time
            }
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
            if (isRecording) {
                recordedNotes.push({ note: note, time: audioContext.currentTime }); 
            }
        });

        key.addEventListener('touchend', (e) => {
            e.preventDefault();
            key.classList.remove('active');
        });
        
        key.addEventListener('mousedown', () => {
            isMouseDown = true;
            triggeredKeys.clear(); 
            if (!triggeredKeys.has(note)) {
                playNote(noteFrequencies[note]);
                triggeredKeys.add(note);
                key.classList.add('active');
            }
        });
      
        key.addEventListener('mouseenter', () => {
            if (isMouseDown && !triggeredKeys.has(note)) {
                playNote(noteFrequencies[note]);
                triggeredKeys.add(note);
                key.classList.add('active');
            }
        });
    });           

    function findKeyNote(key) {
        switch (key) {
            case 'a': return 'C';
            case 's': return 'D';
            case 'd': return 'E';
            case 'f': return 'F';
            case 'g': return 'G';
            case 'h': return 'A';
            case 'j': return 'B';
            case 'k': return 'C1';
            case 'l': return 'D1';

            case 'w': return 'C#';
            case 'e': return 'D#';
            case 't': return 'F#';
            case 'y': return 'G#';
            case 'u': return 'A#';
            case 'o': return 'C#1';
            case 'p': return 'D#1';
        }
    }
    document.addEventListener('keyup', (event) => {
        const key = event.key.toLocaleLowerCase()
        let note = findKeyNote(key);
        if (note) {
            const keyElement = findElementByDataNote(note)
            keyElement.classList.remove('active');
        }
    });
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        let note = findKeyNote(key);
      
        if (note) {
            console.log(`Playing note: ${note}`);
            playNote( noteFrequencies[note]);
            const keyElement = findElementByDataNote(note)
            keyElement.classList.add('active');

            if (isRecording) {
                recordedNotes.push({ note: note, time: audioContext.currentTime }); 
            }
        }
    });
      
    function findElementByDataNote(note) {
        return document.querySelector(`[data-note="${note}"]`);
    }
    

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

    function getRowPosition(note) {
        const rowHeight = 25;
        return (noteRows[note] || 0) + (noteRows[note] || 0)* rowHeight;
    }

    function createRows() {
        const rowHeight = 25; 
        for (const note in noteRows) {
            const row = document.createElement('div');
            row.classList.add('arrangement-row');
            row.setAttribute( 'id', note );
            row.style.top = getRowPosition(note) + 'px';
            row.style.height = rowHeight + 'px';
            arrangementView.appendChild(row);
        }
     }

    function displayNotesInArrangement(recordedNotes, startTime) {
        recordedNotes.forEach((noteData, index) => {
            const noteParentElement = document.getElementById(noteData.note);
            const noteElement = document.createElement('div');
            noteElement.classList.add('arrangement-note');
            noteElement.draggable = true;
            noteElement.dataset.index = index;
    
            updateNoteElement(noteElement, noteData, startTime);
    
            noteParentElement.appendChild(noteElement);
        });
    }
    
    function addFollowTrackCursor() {
        const cursor = document.createElement('div');
        cursor.setAttribute('id', 'cursor-line');

        arrangementView.append(cursor)
    }

    function displayArrangement() {
        arrangementView.innerHTML = '';
    
        if (recordedNotes.length === 0 && !isRecording) {
            arrangementView.textContent = 'No notes recorded.';
            return;
        }
    
        const startTime = recordedNotes[0].time;
        
        createRows();
        displayNotesInArrangement(recordedNotes, startTime)
        attachDragEvents();
        addFollowTrackCursor();
    }
    
    function updateNoteElement(noteElement, noteData, startTime) {
        const relativeTime = noteData.time - startTime;
        noteElement.textContent = `${noteData.note} (${relativeTime.toFixed(2)}s)`;
        noteElement.style.left = (relativeTime * 50) + 'px';
        noteElement.style.top = getRowPosition(noteData.note) + 'px';
    }
    
    function attachDragEvents() {
        const notes = document.querySelectorAll('.arrangement-note');
        let draggingNote = null;
        let dragStartOffsetX = 0;
        let originalTop = 0;
    
        notes.forEach(note => {
            note.addEventListener('mousedown', (e) => {
                draggingNote = note;
                dragStartOffsetX = e.clientX - note.offsetLeft;
                originalTop = note.offsetTop;
                note.classList.add('dragging');
            });
        });
    
        document.addEventListener('mousemove', (e) => {
            if (draggingNote) {
                const newLeft = e.clientX - dragStartOffsetX;
                if (newLeft > 0) {
                    draggingNote.style.left = `${newLeft}px`;

                    draggingNote.style.top = `${originalTop}px`;
                }                
            }
        });
    
        document.addEventListener('mouseup', () => {
            if (draggingNote) {
                const index = parseInt(draggingNote.dataset.index);
                const startTime = recordedNotes[0].time;
                const newTime = startTime + (draggingNote.offsetLeft / 50);
                
                recordedNotes[index].time = newTime;
                
                updateNoteElement(draggingNote, recordedNotes[index], startTime);
                
                draggingNote.classList.remove('dragging');
                draggingNote = null;
            }
        });
    }
    
    let isPlaying = false;
    let playbackStartTime;
    let animationFrameId;
    
    function startPlayback() {
        isPlaying = true;
        playbackStartTime = Date.now();
        moveCursor();
    }
    
    function stopPlayback() {
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
    }
    
    function moveCursor() {
        if (!isPlaying) return;
    
        const currentTime = (Date.now() - playbackStartTime) / 1000; // Convert to seconds
        const cursorPosition = currentTime * pixelsPerSecond;
    
        const cursorLine = document.getElementById('cursor-line');
        cursorLine.style.left = `${cursorPosition}px`;
    
        // Check if we've reached the end of the recorded notes
        if (currentTime - recordedNotes[0].time > recordedNotes[recordedNotes.length - 1].time) {
            if (isLooping) {
                playbackStartTime = Date.now();
            } else {
                stopPlayback();
                return;
            }
        }
    
        animationFrameId = requestAnimationFrame(moveCursor);
    }
    
    // Update the playback button click handler
    document.getElementById('playback-button').addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
            playbackButton.textContent = 'Play Back';
        } else {
            startPlayback();
            playbackButton.textContent = 'Stop';
        }
    });
    
    

    document.addEventListener('mousemove', (e) => {
        if (draggingNote) {
            const newLeft = e.clientX - dragStartOffsetX;
            const initialTop = getRowPosition(draggingNote.dataset.note);
            draggingNote.style.left = newLeft + 'px';
            draggingNote.style.top = initialTop + 'px';  // Keep on the original row
        }
    });

    document.addEventListener('mouseup', () => {
        if (draggingNote) {
            draggingNote.classList.remove('dragging');
            draggingNote = null;
        }
    });
    
    recordButton.addEventListener('click', () => {
        isRecording = !isRecording;
        
        if (isRecording) {
            recordedNotes = []; // Clear previous recording
            console.log('Recording started...');
            recordButton.textContent = 'Stop Recording';
            playbackButton.disabled = true;
            loopButton.disabled = true;
        } else {
            recordingStopTime = audioContext.currentTime;
            console.log('Recording stopped.');
            recordButton.textContent = 'Start Recording';
            playbackButton.disabled = false;
            loopButton.disabled = false;
            
            // Focus on playback button
            playbackButton.focus();
            
            // Enable playback and loop buttons only if notes were recorded
            if (recordedNotes.length > 0) {
                playbackButton.disabled = false;
                loopButton.disabled = false;
            } else {
                console.log('No notes were recorded.');
            }
        }
        
        displayArrangement();
    });

    function playNoteWithDelay(noteData, delay) {
        setTimeout(() => {
            const frequency = noteFrequencies[noteData.note];
            playNote(frequency);
        }, delay * 1000); // Convert delay to milliseconds
    }
    
    // NEW: Playback Function
    playbackButton.addEventListener('click', () => {
      playRecordedNotes()
    });

    function playRecordedNotes() {
        if (recordedNotes.length === 0) return;
    
        const startTime = recordedNotes[0].time;
    
        recordedNotes.forEach(noteData => {
            const relativeTime = noteData.time - startTime;
            playNoteWithDelay(noteData, relativeTime);
        });
    }
    
    
    function startLoop() {
        playRecordedNotes();  // Play the notes once
        const startTime = recordedNotes[0].time;
        const endTime = recordedNotes[recordedNotes.length - 1].time;
        const loopDuration = (recordingStopTime - startTime) * 1000;  // Duration of the recorded sequence in milliseconds
        //loopDuration = 1000

        loopTimeout = setTimeout(() => {
            startPlayback()
            startLoop();  // Schedule the next loop
        }, loopDuration);
        console.log(loopDuration)
    }

    function stopLoop() {
        clearTimeout(loopTimeout); // Clear the timeout
        stopPlayback() // Clear the timeout
    }

    loopButton.addEventListener('click', () => {
        isLooping = !isLooping;
        loopButton.textContent = isLooping ? 'Stop Loop' : 'Start Loop';

        if (isLooping) {
            if (recordedNotes.length === 0) {
                alert('Record something before looping.');
                isLooping = false;
                loopButton.textContent = 'Start Loop';
                return;
            }
            startLoop();
        } else {
            stopLoop();
        }
    });

    drawWaveform();
    drawEQ();
});
