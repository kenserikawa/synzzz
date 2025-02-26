// Instrument interface
export default class Instrument {
    constructor(name) {
        if (this.constructor === Instrument) {
            throw new Error("Instrument is an interface and cannot be instantiated.");
        }
        
        this.name = name;
    }

    play() {
        throw new Error("Method 'play' must be implemented.");
    }

    tune() {
        throw new Error("Method 'tune' must be implemented.");
    }
}
    