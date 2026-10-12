const TICK_MS = 25;            // how often the scheduler wakes up
const LOOKAHEAD = 0.1;         // seconds of audio scheduled ahead of the clock
const HIDDEN_LOOKAHEAD = 1.5;  // background tabs throttle timers to ~1 s
const START_DELAY = 0.05;
const MIN_LOOP_LENGTH = 0.25;
const DEFAULT_NOTE_LENGTH = 0.25;
const LATE_TOLERANCE = 0.05;   // a note due longer ago than this is skipped, not played late

// Holds the recorded take and plays it back on the audio clock ("lookahead scheduler"):
// a timer wakes up every TICK_MS and hands the synth the notes due in the next LOOKAHEAD
// seconds with their exact start time, so timing does not depend on timer jitter.
export default class Arrangement {
    constructor(audioContext, synth, noteFrequencies) {
        this.audioContext = audioContext;
        this.synth = synth;
        this.noteFrequencies = noteFrequencies;
        this.notes = [];
        this.duration = 0;
        this.isPlaying = false;
        this.isLooping = false;
        this.timer = null;
        this.queue = [];
        this.nextIndex = 0;
        this.passStart = 0;
        this.onChange = () => {};      // transport state changed (play, stop, loop)
        this.onNotesChange = () => {}; // the take itself changed (loaded or edited)
    }

    load(notes, duration) {
        this.stop();
        this.notes = notes;
        this.duration = duration;
        this.onNotesChange();
    }

    getNotes() {
        return this.notes;
    }

    // Recording length, stretched if a note was dragged past the end.
    getLength() {
        const lastEnd = this.notes.reduce((end, n) => Math.max(end, n.time + n.duration), 0);
        return Math.max(this.duration, lastEnd, MIN_LOOP_LENGTH);
    }

    removeNote(index) {
        this.notes.splice(index, 1);
        if (this.notes.length === 0) this.stop();
        this.onChange();
        this.onNotesChange();
    }

    // Change a note's start time and/or pitch: updateNote(i, { time, note }).
    updateNote(index, { time, note }) {
        const entry = this.notes[index];
        if (time !== undefined) entry.time = Math.max(0, time);
        if (note !== undefined && note in this.noteFrequencies) entry.note = note;
        this.onNotesChange();
    }

    sortedNotes() {
        return [...this.notes].sort((a, b) => a.time - b.time);
    }

    play() {
        if (this.notes.length === 0) return;
        this.stop();
        this.isPlaying = true;
        this.queue = this.sortedNotes();
        this.nextIndex = 0;
        this.passStart = this.audioContext.currentTime + START_DELAY;
        this.timer = setInterval(() => this.schedule(), TICK_MS);
        this.schedule();
        this.onChange();
    }

    schedule() {
        const now = this.audioContext.currentTime;
        const horizon = now + (document.hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
        const length = this.getLength();

        while (true) {
            if (this.nextIndex >= this.queue.length) {
                const passEnd = this.passStart + length;
                if (!this.isLooping || this.notes.length === 0) {
                    if (now >= passEnd) this.finish();
                    return;
                }
                // Queue the next pass only once it starts inside the horizon, so turning
                // Loop off before then just lets the current pass end.
                if (passEnd >= horizon) return;
                this.passStart = passEnd;
                this.queue = this.sortedNotes(); // picks up notes moved while playing
                this.nextIndex = 0;
                continue;
            }

            const entry = this.queue[this.nextIndex];
            const when = this.passStart + entry.time;
            if (when >= horizon) return;
            this.nextIndex++;

            // Skip notes deleted during this pass and notes already missed (dragged into the
            // past, or a long timer stall) instead of firing them late, all at once.
            if (when < now - LATE_TOLERANCE || !this.notes.includes(entry)) continue;
            const frequency = this.noteFrequencies[entry.note];
            if (frequency) {
                this.synth.playNote(frequency, Math.max(when, now), entry.duration || DEFAULT_NOTE_LENGTH);
            }
        }
    }

    // Playhead in seconds from the start of the take.
    getPosition() {
        if (!this.isPlaying) return 0;
        const length = this.getLength();
        let position = this.audioContext.currentTime - this.passStart;
        // The scheduler may already have queued the next pass up to one lookahead early.
        if (position < 0) position += length;
        return Math.min(Math.max(position, 0), length);
    }

    // User stop: silence what is still queued.
    stop() {
        clearInterval(this.timer);
        this.timer = null;
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.synth.stopScheduled();
        this.onChange();
    }

    // Natural end of the take: let the last notes ring out.
    finish() {
        clearInterval(this.timer);
        this.timer = null;
        this.isPlaying = false;
        this.onChange();
    }

    setLooping(looping) {
        this.isLooping = looping;
        this.onChange();
    }
}
