import Chordophone from "./type/chordophone.js";

export default class Violin extends Chordophone {
    constructor() {
        super("Violin");
    }

    play(frequency, duration) {
        console.log("Bowing violin strings.");
        this.playSound(frequency, duration);
    }

    playSound(frequency, duration) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sawtooth'; // Sawtooth wave for a more string-like sound

        // Create a biquad filter for resonance
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        filter.Q.value = 5;

        // Create a gain node for volume control
        const gainNode = this.audioContext.createGain();

        // Connect the nodes
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.gainNode);

        // Set the frequency
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        // Apply envelope for a more realistic violin sound
        this.applyEnvelope(gainNode, 0.1, 0.3, 0.6, 0.2, 0.8);

        // Add vibrato
        this.addVibrato(oscillator, 5, 10);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration + 0.1 + 0.3 + 0.6 + 0.2);
    }

    addVibrato(oscillator, speed, depth) {
        const vibrato = this.audioContext.createOscillator();
        vibrato.frequency.value = speed;

        const vibratoGain = this.audioContext.createGain();
        vibratoGain.gain.value = depth;

        vibrato.connect(vibratoGain);
        vibratoGain.connect(oscillator.frequency);

        vibrato.start();
    }

    tune() {
        console.log("Tuning violin strings.");
    }
}