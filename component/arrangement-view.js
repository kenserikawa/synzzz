const ROW_HEIGHT = 16;
const PIXELS_PER_SECOND = 80;
const LABEL_WIDTH = 36;
const MIN_NOTE_WIDTH = 6;
const MIN_VISIBLE_SECONDS = 8;
const DRAG_THRESHOLD = 3;   // px before a press on a note counts as a drag
const NUDGE = 0.05;         // seconds per ←/→ press (×10 with Shift)
const OCTAVE = 12;          // rows per ↑/↓ press with Shift

// Piano-roll view of the arrangement: one row per playable note (high notes on top),
// time running left to right. Notes can be dragged in time (horizontally) and in pitch
// (vertically), moved with the arrow keys and removed with a double click or Delete.
// `onPreview(note)` is called when a note lands on a new pitch, to let it be heard.
export default class ArrangementView {
    constructor(arrangement, element, notes, { onPreview = () => {} } = {}) {
        this.arrangement = arrangement;
        this.element = element;
        this.onPreview = onPreview;
        this.rows = [...notes].reverse();
        this.rowIndex = new Map(this.rows.map((note, i) => [note, i]));
        this.drag = null;
        this.frame = null;
        this.gridWidth = 0;
        this.getPosition = null;

        this.grid = document.createElement('div');
        this.grid.className = 'arrangement-grid';
        this.grid.style.height = `${this.rows.length * ROW_HEIGHT}px`;
        this.grid.style.setProperty('--row-height', `${ROW_HEIGHT}px`);
        this.grid.style.setProperty('--label-width', `${LABEL_WIDTH}px`);

        this.notesLayer = document.createElement('div');
        this.notesLayer.className = 'arrangement-notes';

        this.cursor = document.createElement('div');
        this.cursor.className = 'arrangement-cursor';

        this.emptyMessage = document.createElement('p');
        this.emptyMessage.className = 'arrangement-empty pixel-font';
        this.emptyMessage.textContent = 'Press ● REC and play to record';

        this.grid.append(this.createRows(), this.notesLayer, this.cursor);
        this.element.replaceChildren(this.grid, this.emptyMessage);
        this.attachEditing();
        this.setBpm(120);
    }

    createRows() {
        const fragment = document.createDocumentFragment();
        this.rows.forEach((note, i) => {
            const row = document.createElement('div');
            row.className = note.includes('#') ? 'arrangement-row sharp' : 'arrangement-row';
            row.style.top = `${i * ROW_HEIGHT}px`;
            const label = document.createElement('span');
            label.className = 'note-label pixel-font';
            label.textContent = note;
            row.append(label);
            fragment.append(row);
        });
        return fragment;
    }

    setBpm(bpm) {
        this.grid.style.setProperty('--beat-width', `${(60 / bpm) * PIXELS_PER_SECOND}px`);
    }

    setGridWidth(width) {
        this.gridWidth = width;
        this.grid.style.width = `${width}px`;
    }

    timeToX(seconds) {
        return LABEL_WIDTH + seconds * PIXELS_PER_SECOND;
    }

    render() {
        const notes = this.arrangement.getNotes();
        // While the playhead runs (recording), keep the grid wider than it so the view does not jump.
        const playhead = this.getPosition ? this.getPosition() + 4 : 0;
        const seconds = Math.max(this.arrangement.getLength(), MIN_VISIBLE_SECONDS, playhead);
        this.setGridWidth(this.timeToX(seconds) + 40);
        this.emptyMessage.hidden = notes.length > 0;

        const fragment = document.createDocumentFragment();
        notes.forEach((entry, index) => {
            const row = this.rowIndex.get(entry.note);
            if (row === undefined) return;
            const element = document.createElement('div');
            element.className = 'arrangement-note pixel-font';
            element.textContent = entry.note;
            element.dataset.index = index;
            element.tabIndex = 0;
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', `${entry.note} at ${entry.time.toFixed(2)} s`);
            element.title = `${entry.note} · ${entry.time.toFixed(2)} s · drag to move or change pitch · double-click or Delete to remove`;
            element.style.left = `${this.timeToX(entry.time)}px`;
            element.style.top = `${row * ROW_HEIGHT}px`;
            element.style.width = `${Math.max(MIN_NOTE_WIDTH, entry.duration * PIXELS_PER_SECOND)}px`;
            fragment.append(element);
        });
        this.notesLayer.replaceChildren(fragment);
    }

    attachEditing() {
        const noteFrom = event => event.target.closest('.arrangement-note');

        this.notesLayer.addEventListener('pointerdown', event => {
            const element = noteFrom(event);
            if (!element || event.button !== 0) return;
            element.setPointerCapture(event.pointerId);
            const index = Number(element.dataset.index);
            const row = this.rowIndex.get(this.arrangement.getNotes()[index].note);
            this.drag = {
                element,
                index,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: element.offsetLeft,
                left: element.offsetLeft,
                startRow: row,
                row,
                moved: false,
            };
        });

        this.notesLayer.addEventListener('pointermove', event => {
            const drag = this.drag;
            if (!drag) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.moved && Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return;
            drag.moved = true;
            drag.element.classList.add('dragging');

            drag.left = Math.max(LABEL_WIDTH, drag.startLeft + dx);
            drag.element.style.left = `${drag.left}px`;

            const row = this.clampRow(drag.startRow + Math.round(dy / ROW_HEIGHT));
            if (row !== drag.row) {
                drag.row = row;
                drag.element.style.top = `${row * ROW_HEIGHT}px`;
                drag.element.textContent = this.rows[row];
                this.onPreview(this.rows[row]);
            }
        });

        // Uses the stored position: a render() during the drag (recording) detaches the element.
        const endDrag = () => {
            if (!this.drag) return;
            const { index, left, row, moved } = this.drag;
            this.drag = null;
            if (!moved) return;
            this.arrangement.updateNote(index, {
                time: (left - LABEL_WIDTH) / PIXELS_PER_SECOND,
                note: this.rows[row],
            });
            this.render();
        };
        this.notesLayer.addEventListener('pointerup', endDrag);
        this.notesLayer.addEventListener('pointercancel', endDrag);
        this.notesLayer.addEventListener('lostpointercapture', endDrag);

        this.notesLayer.addEventListener('dblclick', event => {
            const element = noteFrom(event);
            if (element) this.removeNote(Number(element.dataset.index));
        });

        this.notesLayer.addEventListener('keydown', event => {
            const element = noteFrom(event);
            if (!element) return;
            const index = Number(element.dataset.index);
            if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                this.removeNote(index);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const step = (event.key === 'ArrowLeft' ? -NUDGE : NUDGE) * (event.shiftKey ? 10 : 1);
                this.arrangement.updateNote(index, { time: this.arrangement.getNotes()[index].time + step });
                this.render();
                this.focusNote(index);
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                // Rows run high → low, so "up" is a smaller row index.
                const step = (event.key === 'ArrowUp' ? -1 : 1) * (event.shiftKey ? OCTAVE : 1);
                const current = this.rowIndex.get(this.arrangement.getNotes()[index].note);
                const note = this.rows[this.clampRow(current + step)];
                this.arrangement.updateNote(index, { note });
                this.onPreview(note);
                this.render();
                this.focusNote(index);
            }
        });
    }

    clampRow(row) {
        return Math.min(this.rows.length - 1, Math.max(0, row));
    }

    removeNote(index) {
        this.arrangement.removeNote(index);
        this.render();
        this.focusNote(Math.min(index, this.arrangement.getNotes().length - 1));
    }

    focusNote(index) {
        this.notesLayer.querySelector(`[data-index="${index}"]`)?.focus();
    }

    // Move the playhead every frame using `getPosition()` (seconds) until stopFollowing().
    follow(getPosition) {
        this.getPosition = getPosition;
        this.element.classList.add('is-following');
        if (this.frame === null) this.frame = requestAnimationFrame(() => this.moveCursor());
    }

    stopFollowing() {
        this.getPosition = null;
        this.element.classList.remove('is-following');
        cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    moveCursor() {
        if (!this.getPosition) return;
        const x = this.timeToX(this.getPosition());
        this.cursor.style.transform = `translateX(${x}px)`;
        // While recording the take grows past the drawn grid.
        if (x + 40 > this.gridWidth) this.setGridWidth(x + 4 * PIXELS_PER_SECOND);

        // Keep the playhead in view.
        const { scrollLeft, clientWidth } = this.element;
        if (x > scrollLeft + clientWidth - 40 || x < scrollLeft + LABEL_WIDTH) {
            this.element.scrollLeft = x - LABEL_WIDTH - 40;
        }
        this.frame = requestAnimationFrame(() => this.moveCursor());
    }
}
