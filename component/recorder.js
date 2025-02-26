export default class Recorder {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isRecording = false;
        this.startTime = null;
        this.stopTime = null;
        this.recordedNotes = [];
    }

    start() {
        this.recordedNotes = [];
        this.isRecording = true;
        this.startTime = this.audioContext.currentTime;
    }

    stop() {
        this.isRecording = false;
        this.stopTime = this.audioContext.currentTime;
    }

    addNote(note, time) {
        if (this.isRecording) {
            this.recordedNotes.push({ note, time });
        }
    }

    getNotes() {
        return this.recordedNotes;
    }

    getDuration() {
        return this.stopTime - this.startTime;
    }
}
