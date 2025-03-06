// chordophone.js
import Instrument from "../interface/instrument.js";

export default class Chordophone extends Instrument {
    constructor(name) {
        super(name);
        if (this.constructor === Chordophone) {
            throw new Error("Chordophone is an abstract class and cannot be instantiated directly.");
        }
    }

    applyEnvelope(gainNode, attack, decay, sustain, sustainLevel, release) {
        const now = this.audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);

        gainNode.gain.linearRampToValueAtTime(1, now + attack);
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);
        gainNode.gain.setValueAtTime(sustainLevel, now + attack + decay + sustain);
        gainNode.gain.linearRampToValueAtTime(0, now + attack + decay + sustain + release);
    }

    play(frequency, duration) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.gainNode);

        this.applyEnvelope(gainNode, 0.1, 0.2, 0.5, 0.3, 0.3); 

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration + 0.1 + 0.2 + 0.5 + 0.3);
    }
}
