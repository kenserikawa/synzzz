const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [3, 4, 5];

// Equal temperament, A4 = 440 Hz, keyed by scientific pitch ("C3" … "B5").
// Insertion order runs low → high, so Object.keys() doubles as the note order.
export const noteFrequencies = Object.fromEntries(
    OCTAVES.flatMap(octave => NOTE_NAMES.map((name, index) => {
        const midi = (octave + 1) * 12 + index;
        return [`${name}${octave}`, 440 * 2 ** ((midi - 69) / 12)];
    }))
);
