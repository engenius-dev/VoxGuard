class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 320; // 20ms frame at 16kHz
    this.frameBuffer = new ArrayBuffer(this.frameSize * 2);
    this.frameView = new DataView(this.frameBuffer);
    this.frameCursor = 0;
  }

  process(inputs) {
    if (sampleRate !== 16000) {
      this.port.postMessage({
        type: "error",
        message: `Expected 16 kHz input, got ${sampleRate} Hz`,
      });
      return false;
    }

    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) {
      return true;
    }

    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      const pcmSample =
        sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
      this.frameView.setInt16(this.frameCursor * 2, pcmSample, true);
      this.frameCursor += 1;

      if (this.frameCursor === this.frameSize) {
        const pcmFrame = this.frameBuffer;
        this.port.postMessage(pcmFrame, [pcmFrame]);
        this.frameBuffer = new ArrayBuffer(this.frameSize * 2);
        this.frameView = new DataView(this.frameBuffer);
        this.frameCursor = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-worklet-processor", PCMWorkletProcessor);