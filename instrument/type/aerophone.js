import Instrument from "../interface/instrument.js";

export default class Aerophone extends Instrument {
    constructor(name) {
        super(name);
        if (this.constructor === Aerophone) {
            throw new Error("Aerophone is an abstract class and cannot be instantiated directly.");
        }
    }

    pluck() {
        console.log(`${this.name} tubes are vibrating.`);
    }
}
