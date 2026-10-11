// Peak level of one voice. About 3 notes fit at full volume before the soft clipper bends the peaks.
const VOICE_LEVEL = 0.3;

// Square and sawtooth carry far more harmonic energy than sine: trim them to similar loudness.
const WAVE_LEVEL = { sine: 1, triangle: 1, sawtooth: 0.85, square: 0.6 };

// Soft clipper: linear up to CLIP_KNEE, then bends smoothly towards ±1 for inputs up to ±CLIP_RANGE.
// Unlike DynamicsCompressorNode (~6 ms look-ahead in Chrome) it adds no latency.
const CLIP_KNEE = 0.6;
const CLIP_RANGE = 4;

const PARAM_SMOOTHING = 0.02;   // seconds (time constant) for knob changes, avoids zipper noise
const REVERB_REBUILD_DELAY = 150; // ms to wait for the fader to settle before rebuilding the impulse

/*
 * Signal flow (built once, voices plug into `input`):
 *
 *   voice → input ─┬─ chorusDry ──────────────────────┐
 *                  └─ chorus L/R (LFO-modulated) ─ chorusWet ─┴→ fxBus
 *   fxBus ─┬────────────────────────────────────────────→ master
 *          ├─ delaySend → delay ⇄ (tone → feedback) → delayReturn → master
 *          └─ reverbSend → convolver → reverbReturn ─────→ master
 *   master → soft clipper → analyser → destination
 */
export default class Synth {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.waveType = 'sine';
        this.envelope = { attack: 0.01, decay: 0.25, sustain: 0.7, release: 0.35 };
        this.liveVoices = new Map();      // note → voice held by a key or pointer
        this.scheduledVoices = new Set(); // one-shots scheduled by arrangement playback
        this.volume = 0.8;
        this.muted = false;
        this.reverbSeconds = 2;
        this.reverbTimer = null;

        this.buildGraph();
    }

    buildGraph() {
        const ctx = this.audioContext;
        const gain = value => {
            const node = ctx.createGain();
            node.gain.value = value;
            return node;
        };

        this.input = gain(1);
        this.fxBus = gain(1);
        this.master = gain(this.volume ** 2);
        this.clipper = this.createSoftClipper();
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        // Chorus: two short delay lines swept in opposite directions and panned apart.
        this.chorusDry = gain(1);
        this.chorusWet = gain(0);
        this.chorusLfo = ctx.createOscillator();
        this.chorusLfo.frequency.value = 0.8;
        this.chorusDepth = [gain(0.003), gain(-0.003)];
        [[0.018, -0.7], [0.024, 0.7]].forEach(([baseDelay, pan], side) => {
            const line = ctx.createDelay(0.1);
            const panner = ctx.createStereoPanner();
            line.delayTime.value = baseDelay;
            panner.pan.value = pan;
            this.chorusLfo.connect(this.chorusDepth[side]).connect(line.delayTime);
            this.input.connect(line).connect(panner).connect(this.chorusWet);
        });
        this.chorusLfo.start();
        this.input.connect(this.chorusDry).connect(this.fxBus);
        this.chorusWet.connect(this.fxBus);

        // Delay: send/return with a low-passed feedback loop so repeats get darker.
        this.delaySend = gain(0);
        this.delay = ctx.createDelay(2);
        this.delay.delayTime.value = 0.3;
        this.delayTone = ctx.createBiquadFilter();
        this.delayTone.type = 'lowpass';
        this.delayTone.frequency.value = 3200;
        this.delayFeedback = gain(0.35);
        this.delayReturn = gain(0.6);
        this.fxBus.connect(this.delaySend).connect(this.delay).connect(this.delayTone);
        this.delayTone.connect(this.delayFeedback).connect(this.delay);
        this.delayTone.connect(this.delayReturn).connect(this.master);

        // Reverb: send/return around a convolver with a generated impulse response.
        this.reverbSend = gain(0);
        this.reverbReturn = gain(0.5);
        this.fxBus.connect(this.reverbSend);
        this.reverbReturn.connect(this.master);
        this.convolver = null;
        this.rebuildReverb();

        this.fxBus.connect(this.master);
        this.master.connect(this.clipper.input);
        this.clipper.output.connect(this.analyser).connect(ctx.destination);
    }

    createSoftClipper() {
        const ctx = this.audioContext;
        const scale = ctx.createGain();      // the shaper reads [-1, 1]: squeeze ±CLIP_RANGE into it
        const shaper = ctx.createWaveShaper();
        const size = 8192;
        const curve = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            const x = ((i / (size - 1)) * 2 - 1) * CLIP_RANGE;
            const magnitude = Math.abs(x);
            const y = magnitude <= CLIP_KNEE
                ? magnitude
                : CLIP_KNEE + (1 - CLIP_KNEE) * Math.tanh((magnitude - CLIP_KNEE) / (1 - CLIP_KNEE));
            curve[i] = Math.sign(x) * y;
        }
        scale.gain.value = 1 / CLIP_RANGE;
        shaper.curve = curve;
        // No oversampling: '2x' would add ~2.7 ms of latency, and aliasing only appears while clipping.
        scale.connect(shaper);
        // Expose a node-like pair: connect into `scale`, out of `shaper`.
        return { input: scale, output: shaper };
    }

    smooth(param, value) {
        param.setTargetAtTime(value, this.audioContext.currentTime, PARAM_SMOOTHING);
    }

    // ── Voices ────────────────────────────────────────────────────────────────

    createVoice(frequency, when) {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        const peak = VOICE_LEVEL * (WAVE_LEVEL[this.waveType] ?? 1);
        const { attack, decay, sustain } = this.envelope;

        osc.type = this.waveType;
        osc.frequency.value = frequency;
        amp.gain.value = 0;
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(peak, when + attack);
        amp.gain.setTargetAtTime(peak * sustain, when + attack, decay / 3);

        osc.connect(amp).connect(this.input);
        osc.start(when);

        const voice = { osc, amp, startTime: when };
        osc.onended = () => {
            osc.disconnect();
            amp.disconnect();
            this.scheduledVoices.delete(voice);
        };
        return voice;
    }

    // Release a voice that is sounding now (key up, stop button).
    releaseVoice(voice, when = this.audioContext.currentTime) {
        const gain = voice.amp.gain;
        const { release } = this.envelope;

        if (voice.startTime > when) {
            // Scheduled but not started yet: never let it sound.
            voice.osc.stop(when);
            voice.amp.disconnect();
            return;
        }
        if (gain.cancelAndHoldAtTime) {
            gain.cancelAndHoldAtTime(when);
        } else {
            const current = gain.value;
            gain.cancelScheduledValues(when);
            gain.setValueAtTime(current, when);
        }
        gain.setTargetAtTime(0, when, release / 5);
        voice.osc.stop(when + release);
    }

    noteOn(note, frequency) {
        this.noteOff(note); // retrigger: release the previous voice of this note
        this.liveVoices.set(note, this.createVoice(frequency, this.audioContext.currentTime));
    }

    noteOff(note) {
        const voice = this.liveVoices.get(note);
        if (!voice) return;
        this.liveVoices.delete(note);
        this.releaseVoice(voice);
    }

    // Fire-and-forget note with a known length, sample-accurate at `when` (audio clock).
    playNote(frequency, when, duration) {
        const voice = this.createVoice(frequency, when);
        const { attack, release } = this.envelope;
        const end = when + Math.max(duration, attack + 0.02);

        voice.amp.gain.setTargetAtTime(0, end, release / 5);
        voice.osc.stop(end + release);
        this.scheduledVoices.add(voice);
    }

    stopScheduled() {
        const now = this.audioContext.currentTime;
        this.scheduledVoices.forEach(voice => this.releaseVoice(voice, now));
        this.scheduledVoices.clear();
    }

    setWaveType(type) {
        this.waveType = type;
    }

    // ── Output ────────────────────────────────────────────────────────────────

    setVolume(volume) {
        this.volume = volume;
        this.applyMasterGain();
    }

    setMuted(muted) {
        this.muted = muted;
        this.applyMasterGain();
    }

    applyMasterGain() {
        // Squared so the fader feels closer to perceived loudness.
        this.smooth(this.master.gain, this.muted ? 0 : this.volume ** 2);
    }

    // ── Effects ───────────────────────────────────────────────────────────────

    enableChorus(enabled) {
        this.smooth(this.chorusWet.gain, enabled ? 0.6 : 0);
    }

    enableDelay(enabled) {
        this.smooth(this.delaySend.gain, enabled ? 1 : 0);
    }

    enableReverb(enabled) {
        this.smooth(this.reverbSend.gain, enabled ? 1 : 0);
    }

    // amount 0…1 → deeper and faster sweep
    setChorusAmount(amount) {
        const depth = 0.001 + amount * 0.005;
        this.smooth(this.chorusDepth[0].gain, depth);
        this.smooth(this.chorusDepth[1].gain, -depth);
        this.smooth(this.chorusLfo.frequency, 0.2 + amount * 1.3);
    }

    setDelayTime(seconds) {
        this.smooth(this.delay.delayTime, seconds);
    }

    setReverbTime(seconds) {
        if (seconds === this.reverbSeconds) return;
        this.reverbSeconds = seconds;
        clearTimeout(this.reverbTimer);
        this.reverbTimer = setTimeout(() => this.rebuildReverb(), REVERB_REBUILD_DELAY);
    }

    rebuildReverb() {
        const next = this.audioContext.createConvolver();
        next.buffer = this.createImpulse(this.reverbSeconds);
        next.connect(this.reverbReturn);
        this.reverbSend.connect(next);

        const previous = this.convolver;
        if (previous) {
            // Stop feeding the old room but let its tail ring out before dropping it.
            this.reverbSend.disconnect(previous);
            setTimeout(() => previous.disconnect(), previous.buffer.duration * 1000);
        }
        this.convolver = next;
    }

    // Stereo noise with an exponential decay that reaches -60 dB at `seconds` (RT60).
    createImpulse(seconds) {
        const rate = this.audioContext.sampleRate;
        const length = Math.max(1, Math.floor(rate * seconds));
        const impulse = this.audioContext.createBuffer(2, length, rate);
        const step = Math.exp(-6.9 / length);

        for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
            const data = impulse.getChannelData(channel);
            let envelope = 1;
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * envelope;
                envelope *= step;
            }
        }
        return impulse;
    }
}
