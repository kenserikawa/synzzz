import Instrument from "../interface/instrument.js";

export default class Electrophone extends Instrument {
    constructor(name) {
        super(name);
        if (this.constructor === Electrophone) {
            throw new Error("Electrophone is an abstract class and cannot be instantiated directly.");
        }
    }

    oscillate() {
        console.log(`${this.name} is oscillating to produce sound.`);
    }
}
