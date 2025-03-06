// Guitar.js
import Chordophone from "./type/chordophone.js";

export default class Guitar extends Chordophone {
    constructor() {
        super("Guitar");
    }

    play(frequency, duration) {
        console.log("Strumming guitar strings.");
        this.playSound(frequency, duration);
    }

    playSound(frequency, duration) {
        const distortion = this.audioContext.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(400);
        distortion.oversample = '4x';

        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        const gainNode = this.audioContext.createGain();
        oscillator.connect(distortion);
        distortion.connect(gainNode);
        gainNode.connect(this.gainNode);

        this.applyEnvelope(gainNode, 0.05, 0.2, 0.5, 0.3, 0.4);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration + 0.05 + 0.2 + 0.5 + 0.4);
    }

    makeDistortionCurve(amount) {
        let k = typeof amount === 'number' ? amount : 50;
        let n_samples = 44100;
        let curve = new Float32Array(n_samples);
        let deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            let x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
}
