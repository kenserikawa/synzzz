import Recorder from "./recorder.js";

export default class Arrangement {
    constructor(audioContext, noteFrequencies) {
        this.audioContext = audioContext;
        this.noteFrequencies = noteFrequencies;
        this.recorder = new Recorder(audioContext);
        this.notes = [];
        this.isLooping = false;
        this.loopTimeout = null;
        this.arrangementView = null;
        this.playbackTimeoutIds = [];
    }

    startRecording() {
        this.recorder.start();
    }

    stopRecording() {
        this.recorder.stop();
        this.notes = this.recorder.getNotes();
    }

    addNote(note, time) {
        this.recorder.addNote(note, time);
    }

    removeNote(index) {
        this.notes.splice(index, 1);
    }

    moveNote(index, newTime) {
        this.notes[index].time = newTime;
    }

    play(playNoteFunction) { 
        if (this.notes.length === 0) return;
        this.stop(); 
        this.startTime = this.audioContext.currentTime;
        this.notes.sort((a, b) => a.time - b.time);

        this.notes.forEach(noteData => {
            const noteTime = noteData.time - this.startTime;
            const playbackTime = this.startTime + noteTime; 

            const timeoutId = setTimeout(() => {
                const frequency = this.noteFrequencies[noteData.note];
                playNoteFunction(frequency);
            }, playbackTime * 1000);

            this.playbackTimeoutIds.push(timeoutId); 
        });

        if (this.arrangementView) {
            this.arrangementView.startPlayback();
        }
    }

    stop() {
        this.playbackTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        this.playbackTimeoutIds = [];

        if (this.arrangementView) {
            this.arrangementView.stopPlayback();
        }
    }

    setLooping(looping, playNoteFunction) {
        this.isLooping = looping;
        if (looping) {
            this.startLoop(playNoteFunction);
        } else {
            this.stopLoop();
        }
    }

    startLoop(playNoteFunction) {
        if (this.notes.length === 0) return; 

        const loopDuration = this.recordingStopTime - this.startTime;

        const loop = () => {
            if (!this.isLooping) return; 
            this.play(playNoteFunction); 

            this.loopTimeout = setTimeout(() => {
                if (this.isLooping) {
                    loop(); 
                }
            }, loopDuration * 1000);
        };

        loop();
    }

    stopLoop() {
        this.isLooping = false;
        clearTimeout(this.loopTimeout);
        this.stop();  
    }

    getNotes() {
        return this.notes;  
    }

    setNotes(notes) {
        this.notes = notes; 
    }
}
