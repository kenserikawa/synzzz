import Instrument from "../interface/instrument.js";

export default class Idiophone extends Instrument {
    constructor(name) {
        super(name);
        if (this.constructor === Idiophone) {
            throw new Error("Idiophone is an abstract class and cannot be instantiated directly.");
        }
    }

    vibrate() {
        console.log(`${this.name} is vibrating to produce sound.`);
    }
}
