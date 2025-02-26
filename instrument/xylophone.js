import Idiophone from "./type/idiophone.js";

export default class Xylophone extends Idiophone {
    constructor() {
        super("Xylophone");
    }
  
    play() {
        console.log("Playing xylophone with mallets.");
        this.vibrate();
    }
  
    tune() {
        console.log("Tuning xylophone bars.");
    }
}