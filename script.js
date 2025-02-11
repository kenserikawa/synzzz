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
        let delayNode = null;
        const reverbToggle = document.getElementById('reverb-toggle');
        let convolverNode = null;
        const chorusToggle = document.getElementById('chorus-toggle');
        let chorusNode = null;
        let lfo = null;

        let isMouseDown = false;
        let triggeredKeys = new Set();
        
        function createChorusNode() {
            chorusNode = audioContext.createDelay();
            chorusNode.delayTime.value = 0.03; // 30ms delay
        
            lfo = audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.5;
        
            const lfoGain = audioContext.createGain();
            lfoGain.gain.value = 0.032;
        
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

        // Function to create and load an impulse response for the reverb
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

        // Add touch support for mobile devices
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

    const baseFrequency = 130.81; // C2
    const numOctaves = 2;
  
    for (let octave = 0; octave < numOctaves; octave++) {
      const octaveMultiplier = Math.pow(2, octave);
      notes.forEach(note => {
        const noteWithOctave = note + (octave + 2); // Octaves starting from 2
        let frequency;
        switch (note) {
          case 'C': frequency = 130.81; break;
          case 'C#': frequency = 138.59; break;
          case 'D': frequency = 146.83; break;
          case 'D#': frequency = 155.56; break;
          case 'E': frequency = 164.81; break;
          case 'F': frequency = 174.61; break;
          case 'F#': frequency = 185.00; break;
          case 'G': frequency = 196.00; break;
          case 'G#': frequency = 207.65; break;
          case 'A': frequency = 220.00; break;
          case 'A#': frequency = 233.08; break;
          case 'B': frequency = 246.94; break;
        }
        noteFrequencies[noteWithOctave] = frequency * octaveMultiplier;
      });
    }

    for (let octave = 0; octave < numOctaves; octave++) {
        notes.forEach(note => {
          const noteWithOctave = note + (octave + 2);
          const isBlackKey = note.includes('#');
          const key = document.createElement('div');
          key.classList.add('key');
          if (isBlackKey) key.classList.add('black');
          key.setAttribute('data-note', noteWithOctave);
    
          key.addEventListener('mousedown', () => {
            const frequency = noteFrequencies[noteWithOctave];
            playNote(frequency);
            key.classList.add('active');
          });
    
          key.addEventListener('mouseup', () => key.classList.remove('active'));
          key.addEventListener('mouseleave', () => key.classList.remove('active'));
    
          // Touch support
          key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const frequency = noteFrequencies[noteWithOctave];
            playNote(frequency);
            key.classList.add('active');
          });
    
          key.addEventListener('touchend', (e) => {
            e.preventDefault();
            key.classList.remove('active');
          });
    
          combinedPiano.appendChild(key);
        });
      }
  
  });
  

// Ensure the document is scrollable
function ensureDocumentIsScrollable() {
  const isScrollable =
    document.documentElement.scrollHeight > window.innerHeight;
  // Check if the document is scrollable
  if (!isScrollable) {
    /*
    Set the document's height to 100 % of
    the viewport height plus one extra pixel
    to make it scrollable.
    */
    document.documentElement.style.setProperty(
      "height",
      "calc(100vh + 1px)",
      "important"
    );
  }
}

function ensureDocumentIsScrollable() {
    const isScrollable =
      document.documentElement.scrollHeight > window.innerHeight;
    // Check if the document is scrollable
    if (!isScrollable) {
      /*
      Set the document's height to 100 % of
      the viewport height plus one extra pixel
      to make it scrollable.
      */
      document.documentElement.style.setProperty(
        "height",
        "calc(100vh + 1px)",
        "important"
      );
    }
  }
  
  // Call ensureDocumentIsScrollable function when the entire page has loaded.
  window.addEventListener("load", ensureDocumentIsScrollable);

  // Prevent windwo.scrollY from becoming zero
function preventCollapse(event) {
    if (window.scrollY === 0) {
      window.scrollTo(0, 1);
    }
  }
  
  // Attach the above function to the touchstart event handler of the scrollable element
  const scrollableElement = document.querySelector(".scrollable");
  scrollableElement.addEventListener("touchstart", preventCollapse);