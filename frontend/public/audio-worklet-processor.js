class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.frameSize = 320;
    this.sourceCursor = 0;
    this.pendingSamples = new Float32Array(0);
    this.frame = new Int16Array(this.frameSize);
    this.frameCursor = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) {
      return true;
    }

    const combined = new Float32Array(this.pendingSamples.length + channel.length);
    combined.set(this.pendingSamples);
    combined.set(channel, this.pendingSamples.length);

    const ratio = sampleRate / this.targetSampleRate;
    while (this.sourceCursor + 1 < combined.length) {
      const lowerIndex = Math.floor(this.sourceCursor);
      const fraction = this.sourceCursor - lowerIndex;
      const sample =
        combined[lowerIndex] * (1 - fraction) +
        combined[lowerIndex + 1] * fraction;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.frame[this.frameCursor] =
        clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
      this.frameCursor += 1;
      this.sourceCursor += ratio;

      if (this.frameCursor === this.frameSize) {
        const pcmFrame = this.frame.buffer;
        this.port.postMessage(pcmFrame, [pcmFrame]);
        this.frame = new Int16Array(this.frameSize);
        this.frameCursor = 0;
      }
    }

    const consumedSamples = Math.min(
      Math.floor(this.sourceCursor),
      combined.length - 1,
    );
    this.pendingSamples = combined.slice(consumedSamples);
    this.sourceCursor -= consumedSamples;
    return true;
  }
}

registerProcessor("pcm-worklet-processor", PCMWorkletProcessor);
