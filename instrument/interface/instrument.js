// instrument.js
export default class Instrument {
    constructor(name) {
        if (this.constructor === Instrument) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.name = name;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.setVolume(0.5);    
    }

    setVolume(volume) {
        this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }

    play(frequency, duration) {
        throw new Error("Method 'play()' must be implemented.");
    }

    stop() {
        throw new Error("Method 'stop()' must be implemented.");
    }

    changeFrequency(frequency) {
        throw new Error("Method 'changeFrequency()' must be implemented.");
    }

    tune() {
        console.log(`${this.name} is being tuned.`);
    }
}
