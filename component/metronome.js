const TICK_MS = 25;
const LOOKAHEAD = 0.1;
const HIDDEN_LOOKAHEAD = 1.5;
const MIN_BPM = 40;
const MAX_BPM = 240;
const BEATS_PER_BAR = 4;
const TAP_RESET_MS = 2000;

// Click track scheduled on the audio clock (same lookahead pattern as Arrangement),
// with an accented downbeat and tap tempo.
export default class Metronome {
    constructor(audioContext, { bpmDisplay, tapButton, metronomeButton, onBpmChange = () => {} }) {
        this.audioContext = audioContext;
        this.bpmDisplay = bpmDisplay;
        this.tapButton = tapButton;
        this.metronomeButton = metronomeButton;
        this.onBpmChange = onBpmChange;
        this.beatsPerMinute = 120;
        this.taps = [];
        this.timer = null;
        this.nextBeatTime = 0;
        this.beat = 0;

        this.output = audioContext.createGain();
        this.output.gain.value = 0.35;
        this.output.connect(audioContext.destination);

        this.tapButton.addEventListener('click', () => this.tap());
        this.metronomeButton.addEventListener('click', () => this.toggle());
        this.updateDisplay();
    }

    get isOn() {
        return this.timer !== null;
    }

    tap() {
        const now = performance.now();
        if (now - (this.taps.at(-1) ?? 0) > TAP_RESET_MS) this.taps = [];
        this.taps = [...this.taps, now].slice(-4);
        if (this.taps.length < 2) return;

        const averageInterval = (this.taps.at(-1) - this.taps[0]) / (this.taps.length - 1);
        this.setBPM(60000 / averageInterval);
    }

    setBPM(bpm) {
        this.beatsPerMinute = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)));
        this.updateDisplay();
        this.onBpmChange(this.beatsPerMinute);
        // A running metronome picks up the new tempo on its next beat.
    }

    getBPM() {
        return this.beatsPerMinute;
    }

    updateDisplay() {
        this.bpmDisplay.textContent = `${this.beatsPerMinute} BPM`;
    }

    toggle() {
        if (this.isOn) this.stop();
        else this.start();
        this.metronomeButton.classList.toggle('active', this.isOn);
        this.metronomeButton.setAttribute('aria-pressed', String(this.isOn));
    }

    start() {
        this.beat = 0;
        this.nextBeatTime = this.audioContext.currentTime + 0.05;
        this.timer = setInterval(() => this.schedule(), TICK_MS);
        this.schedule();
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }

    schedule() {
        const now = this.audioContext.currentTime;
        const horizon = now + (document.hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
        // After a long stall (suspended context, sleeping tab) skip ahead instead of bursting clicks.
        if (this.nextBeatTime < now - 0.2) this.nextBeatTime = now + 0.05;

        while (this.nextBeatTime < horizon) {
            const accent = this.beat % BEATS_PER_BAR === 0;
            this.playTick(this.nextBeatTime, accent);
            this.flash(this.nextBeatTime, accent);
            this.nextBeatTime += 60 / this.beatsPerMinute;
            this.beat++;
        }
    }

    playTick(when, accent) {
        const oscillator = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();

        oscillator.frequency.value = accent ? 1500 : 1000;
        envelope.gain.setValueAtTime(1, when);
        envelope.gain.exponentialRampToValueAtTime(0.001, when + 0.05);

        oscillator.connect(envelope).connect(this.output);
        oscillator.start(when);
        oscillator.stop(when + 0.06);
        oscillator.onended = () => envelope.disconnect();
    }

    // Visual beat, timed to when the click is actually heard.
    flash(when, accent) {
        const delay = Math.max(0, (when - this.audioContext.currentTime) * 1000);
        setTimeout(() => {
            this.bpmDisplay.animate(
                [{ color: accent ? 'rgb(252, 50, 196)' : '#888' }, {}],
                { duration: 180, easing: 'ease-out' }
            );
        }, delay);
    }
}
