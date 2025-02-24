export default class Keyboard {
    constructor(synth, noteFrequencies, keys) {
        this.synth = synth;
        this.noteFrequencies = noteFrequencies; 
        this.keys = keys; 
        this.isMouseDown = false;
        this.triggeredKeys = new Set();

        this.attachEventListeners(); 
    }

    findKeyNote(key) {
        switch (key.toLowerCase()) {
            // Lower row (lower octave)
            case 'z': return 'C';
            case 'x': return 'D';
            case 'c': return 'E';
            case 'v': return 'F';
            case 'b': return 'G';
            case 'n': return 'A';
            case 'm': return 'B';
    
            case 'q': return 'C1';
            case 'w': return 'D1';
            case 'e': return 'E1';
            case 'r': return 'F1';
            case 't': return 'G1';
            case 'y': return 'A1';
            case 'u': return 'B1';
    
            case 's': return 'C#';
            case 'd': return 'D#';
            case 'g': return 'F#';
            case 'h': return 'G#';
            case 'j': return 'A#';
    
            case '2': return 'C#1';
            case '3': return 'D#1';
            case '5': return 'F#1';
            case '6': return 'G#1';
            case '7': return 'A#1';
    
            default: return null;
        }
    }    

    attachEventListeners() {
        this.keys.forEach(key => {
            const note = key.getAttribute('data-note');

            key.addEventListener('mousedown', () => {
                const frequency = this.noteFrequencies[note];
                this.synth.playNote(frequency);
                key.classList.add('active');
            });

            key.addEventListener('mouseup', () => {
                key.classList.remove('active');
            });

            key.addEventListener('mouseleave', () => {
                key.classList.remove('active');
                this.synth.stopNote();
            });

            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const frequency = this.noteFrequencies[note];
                this.synth.playNote(frequency);
                key.classList.add('active');
            });

            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                key.classList.remove('active');
                this.synth.stopNote();
            });

            key.addEventListener('mousedown', () => {
                this.isMouseDown = true;
                this.triggeredKeys.clear(); 
                if (!this.triggeredKeys.has(note)) {
                    this.synth.playNote(this.noteFrequencies[note]);
                    this.triggeredKeys.add(note);
                    key.classList.add('active');
                }
            });

            key.addEventListener('mouseenter', () => {
                if (this.isMouseDown && !this.triggeredKeys.has(note)) {
                    this.synth.playNote(this.noteFrequencies[note]);
                    this.triggeredKeys.add(note);
                    key.classList.add('active');
                }
            });
        });

        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            this.triggeredKeys.clear(); 
        });

        document.addEventListener('mousedown', () => {
            this.isMouseDown = true;
        });
    }

    handleKeyDown(event) {

    }

    handleKeyUp(event) {

    }

    highlightKey(note) {

    }

    unhighlightKey(note) {

    }
}
