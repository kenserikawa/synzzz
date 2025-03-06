import Instrument from "../interface/instrument.js";

export default class Membranophone extends Instrument {
    constructor(name) {
        super(name);
        if (this.constructor === Membranophone) {
            throw new Error("Membranophone is an abstract class and cannot be instantiated directly.");
        }
    }

    struck() {
        console.log(`${this.name} strings are being plucked.`);
    }
}
