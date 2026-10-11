import { keyBindings, keyLabel } from "../util/key-bindings.js";

// Turns pointer (mouse, touch, pen) and computer-keyboard input into note on/off events.
// A note can be held by several sources at once (two fingers, a finger and a key):
// it only starts on the first hold and stops on the last release.
export default class Keyboard {
    constructor(pianoElement, { onNoteOn, onNoteOff }) {
        this.piano = pianoElement;
        this.onNoteOn = onNoteOn;
        this.onNoteOff = onNoteOff;
        this.keyElements = new Map(
            [...pianoElement.querySelectorAll('.key')].map(key => [key.dataset.note, key])
        );
        this.holds = new Map();         // note → number of sources holding it
        this.pointerNotes = new Map();  // pointerId → note under that pointer (null between keys)
        this.pressedCodes = new Set();  // computer keys currently down

        this.labelKeys();
        this.attachPointerEvents();
        this.attachKeyboardEvents();
    }

    // Bindings follow physical keys; print the user's own keycap when the browser can tell
    // (Keyboard Map API, Chromium only), else the QWERTY letter.
    async labelKeys() {
        const setLabels = label => {
            for (const [code, note] of Object.entries(keyBindings)) {
                this.keyElements.get(note)?.setAttribute('data-shortcut', label(code));
            }
        };
        setLabels(keyLabel);
        try {
            const layout = await navigator.keyboard?.getLayoutMap();
            if (layout) setLabels(code => layout.get(code)?.toUpperCase() || keyLabel(code));
        } catch {
            // Not allowed here (e.g. inside an iframe): keep the QWERTY labels.
        }
    }

    press(note) {
        const count = this.holds.get(note) ?? 0;
        this.holds.set(note, count + 1);
        if (count === 0) {
            this.highlightKey(note);
            this.onNoteOn(note);
        }
    }

    release(note) {
        const count = this.holds.get(note) ?? 0;
        if (count > 1) {
            this.holds.set(note, count - 1);
        } else if (count === 1) {
            this.holds.delete(note);
            this.unhighlightKey(note);
            this.onNoteOff(note);
        }
    }

    releaseAll() {
        this.pointerNotes.clear();
        this.pressedCodes.clear();
        for (const note of this.holds.keys()) {
            this.unhighlightKey(note);
            this.onNoteOff(note);
        }
        this.holds.clear();
    }

    noteAt(x, y) {
        return document.elementFromPoint(x, y)?.closest('.key')?.dataset.note ?? null;
    }

    attachPointerEvents() {
        this.piano.addEventListener('pointerdown', event => {
            const note = event.target.closest('.key')?.dataset.note;
            if (!note || event.button !== 0) return;
            event.preventDefault();
            // Keep receiving moves for this pointer so sliding across keys plays a glissando.
            this.piano.setPointerCapture(event.pointerId);
            this.pointerNotes.set(event.pointerId, note);
            this.press(note);
        });

        this.piano.addEventListener('pointermove', event => {
            if (!this.pointerNotes.has(event.pointerId)) return;
            const previous = this.pointerNotes.get(event.pointerId);
            const note = this.noteAt(event.clientX, event.clientY);
            if (note === previous) return;
            if (previous) this.release(previous);
            this.pointerNotes.set(event.pointerId, note);
            if (note) this.press(note);
        });

        const end = event => {
            if (!this.pointerNotes.has(event.pointerId)) return;
            const note = this.pointerNotes.get(event.pointerId);
            this.pointerNotes.delete(event.pointerId);
            if (note) this.release(note);
        };
        this.piano.addEventListener('pointerup', end);
        this.piano.addEventListener('pointercancel', end);
        this.piano.addEventListener('lostpointercapture', end);
    }

    attachKeyboardEvents() {
        document.addEventListener('keydown', event => this.handleKeyDown(event));
        document.addEventListener('keyup', event => this.handleKeyUp(event));
        // A key released while the window is in the background never sends keyup.
        window.addEventListener('blur', () => this.releaseAll());
    }

    handleKeyDown(event) {
        const note = keyBindings[event.code];
        if (!note || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        if (this.pressedCodes.has(event.code)) return;
        this.pressedCodes.add(event.code);
        this.press(note);
    }

    handleKeyUp(event) {
        if (!this.pressedCodes.delete(event.code)) return;
        this.release(keyBindings[event.code]);
    }

    highlightKey(note) {
        this.keyElements.get(note)?.classList.add('active');
    }

    unhighlightKey(note) {
        this.keyElements.get(note)?.classList.remove('active');
    }
}
