import Instrument from "../interface/instrument.js";

export default class Chordophone extends Instrument {
    constructor(name) {
        super(name);
        if (this.constructor === Chordophone) {
            throw new Error("Chordophone is an abstract class and cannot be instantiated directly.");
        }
    }

    pluck() {
        console.log(`${this.name} strings are being plucked.`);
    }
}
