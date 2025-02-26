import Chordophone from "./type/chordophone.js";

export default class Guitar extends Chordophone {
    constructor() {
        super("Guitar");
    }
  
    play() {
        console.log("Strumming guitar strings.");
        this.pluck();
    }
  
    tune() {
        console.log("Tuning guitar strings.");
    }
}