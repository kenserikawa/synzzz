export default class Metronome {
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

        this.setupEventListeners(); 
    }

    setupEventListeners() {

        this.tapButton.addEventListener('click', () => this.calculateBPM());

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

        this.oscillator.type = 'sine'; 
        this.oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime); 

        this.gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);  
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        this.oscillator.start();
        this.oscillator.stop(this.audioContext.currentTime + 0.1); 
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
