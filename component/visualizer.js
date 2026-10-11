const WAVE_COLOR = 'rgb(252, 50, 196)';
const BAR_COUNT = 16;
const MIN_FREQUENCY = 40;
const MAX_FREQUENCY = 16000;
const WAVE_WINDOW = 1024; // samples drawn on the oscilloscope (~21 ms at 48 kHz)

export default class Visualizer {
    constructor(analyser, waveformCanvas, eqCanvas) {
        this.analyser = analyser;
        this.waveform = this.setupCanvas(waveformCanvas);
        this.eq = this.setupCanvas(eqCanvas);
        this.timeData = new Uint8Array(analyser.fftSize);
        this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
        this.bands = this.computeBands();
        this.wasSilent = false;
        this.draw = this.draw.bind(this);
    }

    // Back the canvas with device pixels so lines stay crisp on HiDPI screens.
    setupCanvas(canvas) {
        const { width, height } = canvas;
        const ratio = window.devicePixelRatio || 1;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const context = canvas.getContext('2d');
        context.scale(ratio, ratio);
        return { context, width, height };
    }

    // Log-spaced frequency bands, so each bar covers a similar musical range.
    computeBands() {
        const binWidth = this.analyser.context.sampleRate / this.analyser.fftSize;
        const span = MAX_FREQUENCY / MIN_FREQUENCY;
        return Array.from({ length: BAR_COUNT }, (_, i) => {
            const start = Math.floor(MIN_FREQUENCY * span ** (i / BAR_COUNT) / binWidth);
            const end = Math.ceil(MIN_FREQUENCY * span ** ((i + 1) / BAR_COUNT) / binWidth);
            return [start, Math.max(start + 1, end)];
        });
    }

    start() {
        requestAnimationFrame(this.draw);
    }

    draw() {
        requestAnimationFrame(this.draw);
        this.analyser.getByteTimeDomainData(this.timeData);
        this.analyser.getByteFrequencyData(this.frequencyData);

        // Nothing changes on screen while silent: skip repainting after the first silent frame.
        const silent = this.frequencyData.every(value => value === 0);
        if (silent && this.wasSilent) return;
        this.wasSilent = silent;

        this.drawWaveform();
        this.drawEQ();
    }

    drawWaveform() {
        const { context, width, height } = this.waveform;
        const data = this.timeData;

        // Start at a rising zero crossing so the wave stands still instead of scrolling.
        let offset = 1;
        while (offset < data.length - WAVE_WINDOW && !(data[offset - 1] < 128 && data[offset] >= 128)) offset++;
        if (offset >= data.length - WAVE_WINDOW) offset = 0;

        const points = Math.min(WAVE_WINDOW, width * 2);
        const stride = WAVE_WINDOW / points;

        context.clearRect(0, 0, width, height);
        context.lineWidth = 2;
        context.strokeStyle = WAVE_COLOR;
        context.beginPath();
        for (let i = 0; i <= points; i++) {
            const sample = data[offset + Math.min(WAVE_WINDOW - 1, Math.floor(i * stride))];
            const y = (sample / 255) * height;
            if (i === 0) context.moveTo(0, y);
            else context.lineTo((i / points) * width, y);
        }
        context.stroke();
    }

    drawEQ() {
        const { context, width, height } = this.eq;
        const barWidth = width / BAR_COUNT;

        context.clearRect(0, 0, width, height);
        this.bands.forEach(([start, end], i) => {
            let level = 0;
            for (let bin = start; bin < end; bin++) level = Math.max(level, this.frequencyData[bin]);
            const barHeight = (level / 255) * height;
            context.fillStyle = `rgb(${100 + Math.round(level * 0.6)}, 50, 196)`;
            context.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        });
    }
}
