// Computer keyboard → note, by physical key (event.code) so QWERTZ/AZERTY layouts
// keep the same piano shape. Bottom row = lower octave, top row = upper octave.
export const keyBindings = {
    KeyZ: 'C3', KeyS: 'C#3', KeyX: 'D3', KeyD: 'D#3', KeyC: 'E3', KeyV: 'F3',
    KeyG: 'F#3', KeyB: 'G3', KeyH: 'G#3', KeyN: 'A3', KeyJ: 'A#3', KeyM: 'B3',

    KeyQ: 'C4', Digit2: 'C#4', KeyW: 'D4', Digit3: 'D#4', KeyE: 'E4', KeyR: 'F4',
    Digit5: 'F#4', KeyT: 'G4', Digit6: 'G#4', KeyY: 'A4', Digit7: 'A#4', KeyU: 'B4',
};

export const keyLabel = code => code.replace(/^(Key|Digit)/, '');
