document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const keys = document.querySelectorAll('.key');
    const waveSelector = document.getElementById('wave-type');

    // Default wave type
    let currentWaveType = 'sine';

    // Update wave type when dropdown changes
    waveSelector.addEventListener('change', (event) => {
        currentWaveType = event.target.value; // Update the global wave type
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
        delayNode.delayTime.value = 0.3;
    
        const feedbackNode = audioContext.createGain();
        feedbackNode.gain.value = 0.4; 
    
        delayNode.connect(feedbackNode);
        feedbackNode.connect(delayNode);
    
        return delayNode;
    }

    async function createReverbNode() {
        convolverNode = audioContext.createConvolver();

        // Generate a simple impulse response (white noise decay)
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * 2; // 2 seconds
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

    function playNote(frequency) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = currentWaveType;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);

        gainNode.gain.linearRampToValueAtTime(
          1,
          audioContext.currentTime + attackTime
        );
        gainNode.gain.exponentialRampToValueAtTime(
          sustainLevel,
          audioContext.currentTime + attackTime + decayTime
        );

        // keep analyser before anything else !important :)
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
        gainNode.gain.setValueAtTime(
          gainNode.gain.value,
          audioContext.currentTime
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + releaseTime
        );

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
