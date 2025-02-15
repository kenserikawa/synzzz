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

    const attackTime = 0.12;
    const decayTime = 2;
    const sustainLevel = 7;
    const releaseTime = 2;

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
    
        const barWidth = (eqCanvas.width / eqBufferLength) * 10;
        let barHeight;
        let x = 0;
    
        for (let i = 0; i < eqBufferLength; i++) {
            barHeight = eqDataArray[i];
    
            eqContext.fillStyle = 'rgb('+ (barHeight + 100) + ',18, 96)';
            eqContext.fillRect(x, eqCanvas.height - barHeight / 2, barWidth, barHeight / 2);
    
            x += barWidth * 2;
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

    function displayArrangement() {
        arrangementView.innerHTML = ''; // Clear previous arrangement

        if (recordedNotes.length === 0) {
            arrangementView.textContent = 'No notes recorded.';
            return;
        }

        const startTime = recordedNotes[0].time; // Get the start time of the first note

        recordedNotes.forEach(noteData => {
            const noteElement = document.createElement('div');
            noteElement.textContent = noteData.note;
            noteElement.classList.add('arrangement-note');

            // Calculate the position of the note based on its time relative to the start time
            const relativeTime = noteData.time - startTime;
            noteElement.style.left = (relativeTime * 50) + 'px'; // Adjust the scaling factor (50) as needed

            arrangementView.appendChild(noteElement);
        });
    }

    recordButton.addEventListener('click', () => {
        isRecording = !isRecording;
        recordButton.textContent = isRecording ? 'Stop Recording' : 'Start Recording';

        if (isRecording) {
            recordedNotes = []; // Clear previous recording
            console.log('Recording started...');
        } else {
            recordingStopTime = audioContext.currentTime;

            console.log('Recording stopped.');
            displayArrangement();  // Display the recorded notes
        }
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
            startLoop();  // Schedule the next loop
        }, loopDuration);
        console.log(loopDuration)
    }

    function stopLoop() {
        clearTimeout(loopTimeout); // Clear the timeout
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
