import Idiophone from "./type/idiophone.js";

export default class Cymbal extends Idiophone {
    constructor() {
        super("Cymbal");
    }
  
    play() {
        console.log("Crashing the cymbal.");
        this.vibrate();
    }
  
    tune() {
        console.log("Adjusting cymbal tension.");
    }
}