import Chordophone from "./type/chordophone.js";

export default class Violin extends Chordophone {
    constructor() {
        super("Violin");
    }
  
    play() {
        console.log("Bowing violin strings.");
        this.pluck();
    }
  
    tune() {
        console.log("Tuning violin strings.");
    }
}