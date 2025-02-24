export default class Arrangement {
    constructor(audioContext, noteFrequencies) {
        this.audioContext = audioContext;
        this.noteFrequencies = noteFrequencies;
        this.recordedNotes = [];
        this.isRecording = false;
        this.isLooping = false;
        this.loopTimeout = null;
        this.recordingStopTime = null;
        this.startTime = null;
        this.arrangementView = null;
        this.playbackTimeoutIds = [];  
    }

    startRecording() {
        this.recordedNotes = [];
        this.isRecording = true;
        this.startTime = this.audioContext.currentTime;  
    }

    stopRecording() {
        this.isRecording = false;
        this.recordingStopTime = this.audioContext.currentTime;
    }

    addNote(note, time) {
        if (this.isRecording) {
            this.recordedNotes.push({ note: note, time: time });
        }
    }

    removeNote(index) {
        this.recordedNotes.splice(index, 1);
    }

    moveNote(index, newTime) {
        this.recordedNotes[index].time = newTime;
    }

    play(playNoteFunction) { 
        if (this.recordedNotes.length === 0) return;
        this.stop(); 
        this.startTime = this.audioContext.currentTime;
        this.recordedNotes.sort((a, b) => a.time - b.time);

        this.recordedNotes.forEach(noteData => {
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
        if (this.recordedNotes.length === 0) return; 

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
        return this.recordedNotes;  
    }

    setNotes(notes) {
        this.recordedNotes = notes; 
    }
}
