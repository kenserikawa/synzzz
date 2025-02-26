export default class ArrangementView {
    constructor(arrangement, arrangementViewElement) {
        this.arrangement = arrangement;
        this.arrangementViewElement = arrangementViewElement;
        this.draggingNote = null;
        this.dragStartOffsetX = 0;
        this.dragStartOffsetY = 0;
        this.cursor = null; 
        this.pixelsPerSecond = 50; 
        this.isPlaying = false; 
        this.playbackStartTime = null; 
        this.animationFrameId = null; 

        this.addFollowTrackCursor(); 
    }

    addFollowTrackCursor() {
        this.cursor = document.createElement('div');
        this.cursor.setAttribute('id', 'cursor-line');
        this.arrangementViewElement.appendChild(this.cursor);
    }

    moveCursor() {
        if (!this.isPlaying) return;

        const currentTime = (Date.now() - this.playbackStartTime) / 1000; 
        const cursorPosition = currentTime * this.pixelsPerSecond; 

        this.cursor.style.left = `${cursorPosition}px`; 

        const recordedNotes = this.arrangement.getNotes();
        if (recordedNotes.length > 0 && currentTime > recordedNotes[recordedNotes.length - 1].time) {
            if (this.arrangement.isLooping) {
                this.playbackStartTime = Date.now(); 
            } else {
                this.stopPlayback(); 
                return;
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.moveCursor());
    }

    startPlayback() {
        this.isPlaying = true;
        this.playbackStartTime = Date.now(); 
        this.moveCursor(); 
    }

    stopPlayback() {
        this.isPlaying = false;
        cancelAnimationFrame(this.animationFrameId); 
        this.cursor.style.left = '0px'; 
    }

    render() {
        this.arrangementViewElement.innerHTML = ''; 
        const recordedNotes = this.arrangement.getNotes(); 
        if (recordedNotes.length === 0) {
            this.arrangementViewElement.textContent = 'No notes recorded.';
            return;
        }

        this.createRows();

        const startTime = recordedNotes[0].time;

        recordedNotes.forEach(noteData => {
            const noteElement = document.createElement('div');
            const noteText = `${noteData.note} (${(noteData.time - startTime).toFixed(2)}s)`; 

            noteElement.textContent = noteText;
            noteElement.classList.add('arrangement-note');
            noteElement.setAttribute('data-note', noteData.note); 

            const relativeTime = noteData.time - startTime;
            noteElement.style.left = (relativeTime * this.pixelsPerSecond) + 'px'; 
            noteElement.style.top = this.getRowPosition(noteData.note) + 'px'; 

            noteElement.draggable = true;
            this.arrangementViewElement.appendChild(noteElement);
        });

        this.attachDragEvents();
    }

    createRows() {
        const noteRows = {  
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
            'C1': 12, 'C#1': 13, 'D1': 14, 'D#1': 15, 'E1': 16, 'F1': 17, 'F#1': 18, 'G1': 19, 'G#1': 20, 'A1': 21, 'A#1': 22, 'B1': 23,
            'C2': 24, 'C#2': 25, 'D2': 26, 'D#2': 27, 'E2': 28, 'F2': 29 
        };
        const rowHeight = 25; 
        for (const note in noteRows) {
            const row = document.createElement('div');
            row.classList.add('arrangement-row');
            row.style.top = this.getRowPosition(note) + 'px';
            row.style.height = rowHeight + 'px';
            this.arrangementViewElement.appendChild(row);
        }
    }

    getRowPosition(note) {
        const noteRows = {  
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
            'C1': 12, 'C#1': 13, 'D1': 14, 'D#1': 15, 'E1': 16, 'F1': 17, 'F#1': 18, 'G1': 19, 'G#1': 20, 'A1': 21, 'A#1': 22, 'B1': 23,
            'C2': 24, 'C#2': 25, 'D2': 26, 'D#2': 27, 'E2': 28, 'F2': 29 
        };

        const rowHeight = 25; 
        return (noteRows[note] || 0) * rowHeight; 
    }

    attachDragEvents() {
        const notes = this.arrangementViewElement.querySelectorAll('.arrangement-note');

        notes.forEach(note => {
            note.addEventListener('mousedown', (e) => {
                this.draggingNote = note;
                this.dragStartOffsetX = e.clientX - note.offsetLeft;
                this.dragStartOffsetY = e.clientY - note.offsetTop;  
                note.classList.add('dragging');
            });
        });
    }

    handleDrag(event) {
        if (this.draggingNote) {
            const newLeft = event.clientX - this.dragStartOffsetX;
            const initialTop = this.getRowPosition(this.draggingNote.dataset.note);
            this.draggingNote.style.left = newLeft + 'px';
            this.draggingNote.style.top = initialTop + 'px'; 
        }
    }

    handleDragEnd() {
        if (this.draggingNote) {
            this.draggingNote.classList.remove('dragging');
            this.draggingNote = null;
        }
    }
}
