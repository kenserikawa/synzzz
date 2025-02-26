export default class Visualizer {
    constructor(audioContext, waveformCanvas, eqCanvas) {
        this.audioContext = audioContext;
        this.waveformCanvas = waveformCanvas;
        this.eqCanvas = eqCanvas;
        this.waveformContext = waveformCanvas.getContext("2d");
        this.eqContext = eqCanvas.getContext("2d");

        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        this.eqAnalyser = audioContext.createAnalyser();
        this.eqAnalyser.fftSize = 256;

        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        this.eqBufferLength = this.eqAnalyser.frequencyBinCount;
        this.eqDataArray = new Uint8Array(this.eqBufferLength);
    }

    drawWaveform() {
        this.waveformContext.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
        this.analyser.getByteTimeDomainData(this.dataArray);

        this.waveformContext.lineWidth = 2;
        this.waveformContext.strokeStyle = "rgb(252, 50, 196)";

        this.waveformContext.beginPath();

        const sliceWidth = (this.waveformCanvas.width * 1.0) / this.bufferLength;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = (v * this.waveformCanvas.height) / 2;

            if (i === 0) {
                this.waveformContext.moveTo(x, y);
            } else {
                this.waveformContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.waveformContext.lineTo(this.waveformCanvas.width, this.waveformCanvas.height / 2);
        this.waveformContext.stroke();

        requestAnimationFrame(() => this.drawWaveform()); 
    }

    drawEQ() {
        this.eqAnalyser.getByteFrequencyData(this.eqDataArray);
        this.eqContext.clearRect(0, 0, this.eqCanvas.width, this.eqCanvas.height);

        const barWidth = (this.eqCanvas.width / this.eqBufferLength) * 2.5;
        let barHeight = 0;
        let x = 0;

        for (let i = 0; i < this.eqBufferLength; i++) {
            barHeight = Math.max(0, this.eqDataArray[i] - 10); 

            this.eqContext.fillStyle = 'rgb(' + (barHeight + 100) + ',50, 196)';
            this.eqContext.fillRect(x, this.eqCanvas.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }

        requestAnimationFrame(() => this.drawEQ()); 
    }

    connectSource(source) {
        source.connect(this.analyser);
        source.connect(this.eqAnalyser);
    }
}
