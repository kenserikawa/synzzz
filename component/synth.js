export default class Synth {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.oscillator = null; 
        this.gainNode = null; 
        this.delayNode = null;
        this.reverbNode = null;
        this.chorusNode = null;
        this.lfo = null;
        this.analyser = audioContext.createAnalyser();
        this.eqAnalyser = audioContext.createAnalyser();

        this.currentWaveType = 'sine';
        this.currentDelayTime = 0.3;
        this.currentReverbTime = 1;
        this.currentChorusTime = 0.2;

        this.attackTime = 0;
        this.decayTime = 1;
        this.sustainLevel = 1;
        this.releaseTime = 1;

        this.eqAnalyser.fftSize = 256;

        this.connectSource = function(source) {
            source.connect(this.analyser);
            source.connect(this.eqAnalyser);
        }
    }

    playNote(frequency) {
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        const rampValue = 0.001;

        this.oscillator.type = this.currentWaveType;
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        this.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(rampValue, this.audioContext.currentTime + 1);
        this.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + this.attackTime);
        this.gainNode.gain.exponentialRampToValueAtTime(this.sustainLevel, this.audioContext.currentTime + this.attackTime + this.decayTime);

        this.oscillator.connect(this.analyser);
        this.oscillator.connect(this.gainNode);

        let currentNode = this.gainNode;

        if (this.chorusNode) {
            currentNode.connect(this.chorusNode);
            currentNode = this.chorusNode;
        }

        if (this.delayNode) {
            currentNode.connect(this.delayNode);
            currentNode = this.delayNode;
        }

        if (this.reverbNode) {
            currentNode.connect(this.reverbNode);
            this.reverbNode.connect(this.audioContext.destination);
        } else {
            currentNode.connect(this.audioContext.destination);
        }

        this.oscillator.start();
        this.oscillator.stop(this.audioContext.currentTime + 1);
        this.oscillator.stop(this.audioContext.currentTime + this.attackTime + this.decayTime + this.releaseTime);

        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(rampValue, this.audioContext.currentTime + this.releaseTime);
    }

    stopNote() {
        if (this.oscillator && this.gainNode) {
            const now = this.audioContext.currentTime;
            const release = now + this.releaseTime;
    
            this.gainNode.gain.cancelScheduledValues(now);
    
            const currentGain = this.gainNode.gain.value;
    
            this.gainNode.gain.setValueAtTime(currentGain, now);
            this.gainNode.gain.exponentialRampToValueAtTime(0.001, release);
            this.oscillator.stop(release);

            setTimeout(() => {
                if (this.oscillator) {
                    this.oscillator.disconnect();
                    this.oscillator = null;
                }
                if (this.gainNode) {
                    this.gainNode.disconnect();
                    this.gainNode = null;
                }
            }, this.releaseTime * 1000);
        }
    }
    
    setWaveType(type) {
        this.currentWaveType = type;
    }

    setDelayTime(time) {
        this.currentDelayTime = time;
        if (this.delayNode) {
            this.delayNode.delayTime.value = this.currentDelayTime;
        }
    }

    setReverbTime(time) {
        this.currentReverbTime = time;
        this.createReverbNode();
    }

    setChorusTime(time) {
        this.currentChorusTime = time;
        this.createChorusNode();
    }

    enableDelay(enabled) {
        if (enabled && !this.delayNode) {
            this.createDelayNode();
        } else if (!enabled && this.delayNode) {
            this.delayNode.disconnect();
            this.delayNode = null;
        }
    }

    enableReverb(enabled) {
        if (enabled && !this.reverbNode) {
            this.createReverbNode();
        } else if (!enabled && this.reverbNode) {
            this.reverbNode.disconnect();
            this.reverbNode = null;
        }
    }

    enableChorus(enabled) {
        if (enabled && !this.chorusNode) {
            this.createChorusNode();
        } else if (!enabled && this.chorusNode) {
            this.chorusNode.disconnect();
            this.chorusNode = null;
            if (this.lfo) {
                this.lfo.stop();
                this.lfo.disconnect();
                this.lfo = null;
            }
        }
    }

    createChorusNode() {
        this.chorusNode = this.audioContext.createDelay();
        this.chorusNode.delayTime.value = this.currentChorusTime; 

        this.lfo = this.audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 1;

        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 0.32;

        this.lfo.connect(lfoGain);
        lfoGain.connect(this.chorusNode.delayTime);
        this.lfo.start();

        return this.chorusNode;
    }

    createDelayNode() {
        this.delayNode = this.audioContext.createDelay(5.0);
        this.delayNode.delayTime.value = this.currentDelayTime; 

        const feedbackNode = this.audioContext.createGain();
        feedbackNode.gain.value = 0.4;

        this.delayNode.connect(feedbackNode);
        feedbackNode.connect(this.delayNode);

        return this.delayNode;
    }

    async createReverbNode() {
        this.reverbNode = this.audioContext.createConvolver();

        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * this.currentReverbTime;
        const impulseBuffer = this.audioContext.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < impulseBuffer.numberOfChannels; channel++) {
            const channelData = impulseBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * (1 - i / length);
            }
        }

        this.reverbNode.buffer = impulseBuffer;
        return this.reverbNode;
    }
}
