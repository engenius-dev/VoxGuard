import { Activity } from "lucide-react";
import { useEffect, useRef } from "react";

interface LiveWaveformProps {
  samples: Float32Array;
  isActive: boolean;
}

export function LiveWaveform({
  samples,
  isActive,
}: LiveWaveformProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(bounds.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(bounds.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawWaveform();
    });

    const drawWaveform = (): void => {
      const bounds = canvas.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      context.clearRect(0, 0, width, height);

      context.strokeStyle = "rgba(141, 164, 194, 0.09)";
      context.lineWidth = 1;
      for (let x = 0; x <= width; x += 44) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y <= height; y += 34) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.beginPath();
      context.moveTo(0, height / 2);
      if (samples.length > 1 && isActive) {
        const step = width / (samples.length - 1);
        for (let index = 0; index < samples.length; index += 1) {
          const x = index * step;
          const y = height / 2 - samples[index] * height * 0.42;
          context.lineTo(x, y);
        }
      } else {
        context.lineTo(width, height / 2);
      }
      context.strokeStyle = isActive ? "#40d9c0" : "#3c506b";
      context.lineWidth = 2;
      context.shadowColor = isActive ? "rgba(64, 217, 192, 0.5)" : "transparent";
      context.shadowBlur = isActive ? 12 : 0;
      context.stroke();
      context.shadowBlur = 0;
    };

    resizeObserver.observe(canvas);
    drawWaveform();
    return () => resizeObserver.disconnect();
  }, [samples, isActive]);

  return (
    <section className="panel waveform-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Input signal</p>
          <h2>Live waveform</h2>
        </div>
        <span className={`live-indicator ${isActive ? "is-live" : ""}`}>
          <Activity size={14} />
          {isActive ? "LIVE" : "STANDBY"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        aria-label="Live microphone time-domain waveform"
        role="img"
      />
      <div className="waveform-meta">
        <span>TIME DOMAIN</span>
        <span>16 kHz · MONO</span>
      </div>
    </section>
  );
}
