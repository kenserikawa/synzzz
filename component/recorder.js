// Captures notes as { note, time, duration } in seconds from the start of the take,
// measured on the audio clock so playback lines up with what was heard.
export default class Recorder {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isRecording = false;
        this.startTime = 0;
        this.duration = 0;
        this.notes = [];
        this.openNotes = new Map(); // note → entry still held down
    }

    start() {
        this.notes = [];
        this.openNotes.clear();
        this.duration = 0;
        this.startTime = this.audioContext.currentTime;
        this.isRecording = true;
    }

    stop() {
        if (!this.isRecording) return;
        const now = this.elapsed();
        this.openNotes.forEach(entry => { entry.duration = now - entry.time; });
        this.openNotes.clear();
        this.duration = now;
        this.isRecording = false;
    }

    elapsed() {
        return this.audioContext.currentTime - this.startTime;
    }

    noteOn(note) {
        if (!this.isRecording) return false;
        const entry = { note, time: this.elapsed(), duration: 0 };
        this.notes.push(entry);
        this.openNotes.set(note, entry);
        return true;
    }

    noteOff(note) {
        const entry = this.openNotes.get(note);
        if (!entry) return false;
        entry.duration = this.elapsed() - entry.time;
        this.openNotes.delete(note);
        return true;
    }

    getNotes() {
        return this.notes;
    }

    getDuration() {
        return this.duration;
    }
}
