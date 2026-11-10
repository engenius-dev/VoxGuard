import { useCallback, useEffect, useRef, useState } from "react";

import type { AudioStreamStatus, DIRIScore } from "../types";

interface UseAudioStreamResult {
  startStream: () => Promise<void>;
  stopStream: () => void;
  isStreaming: boolean;
  sessionId: string;
  status: AudioStreamStatus;
  error: string | null;
  lastResult: DIRIScore | null;
  waveformData: Float32Array;
}

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDIRIScore(value: unknown): DIRIScore | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.session_id !== "string" ||
    typeof result.diri_score !== "number" ||
    typeof result.raw_score !== "number" ||
    result.status !== "processed"
  ) {
    return null;
  }
  return {
    session_id: result.session_id,
    diri_score: result.diri_score,
    raw_score: result.raw_score,
    status: "processed",
  };
}

export function useAudioStream(): UseAudioStreamResult {
  const [sessionId, setSessionId] = useState<string>(createSessionId);
  const [status, setStatus] = useState<AudioStreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DIRIScore | null>(null);
  const [waveformData, setWaveformData] = useState<Float32Array>(
    () => new Float32Array(0),
  );
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const releaseResources = useCallback((): void => {
    nodesRef.current.forEach((node) => node.disconnect());
    nodesRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "Audio stream stopped");
    }
  }, []);

  const stopStream = useCallback((): void => {
    releaseResources();
    setLastResult(null);
    setWaveformData(new Float32Array(0));
    setStatus("idle");
  }, [releaseResources]);

  const startStream = useCallback(async (): Promise<void> => {
    if (status === "connecting" || status === "streaming") {
      return;
    }
    
    // Generate a fresh session ID for every new recording stream
    const newSessionId = createSessionId();
    setSessionId(newSessionId);

    setStatus("connecting");
    setError(null);
    setLastResult(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone capture is not available in this browser.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = mediaStream;

      const AudioContextConstructor =
        window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("Web Audio is not supported in this browser.");
      }
      const audioContext = new AudioContextConstructor({ sampleRate: 16000 });
      if (audioContext.sampleRate !== 16000) {
        await audioContext.close();
        throw new Error(
          `Expected 16 kHz AudioContext, got ${audioContext.sampleRate} Hz.`,
        );
      }
      audioContextRef.current = audioContext;
      await audioContext.resume();
      await audioContext.audioWorklet.addModule("/audio-worklet-processor.js");

      // Use the newly generated ID here
      const socket = new WebSocket(
        `ws://localhost:8000/ws/ingest/${encodeURIComponent(newSessionId)}`,
      );
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      await new Promise<void>((resolve, reject): void => {
        const timeout = window.setTimeout(() => {
          reject(new Error("Timed out connecting to the VoxGuard audio service."));
        }, 10000);
        socket.addEventListener(
          "open",
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
        socket.addEventListener(
          "error",
          () => {
            window.clearTimeout(timeout);
            reject(new Error("Could not connect to the VoxGuard audio service."));
          },
          { once: true },
        );
      });
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error("The audio service disconnected during setup.");
      }

      socket.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (typeof event.data !== "string") {
          return;
        }
        try {
          const result = parseDIRIScore(JSON.parse(event.data) as unknown);
          if (result) {
            setLastResult(result);
          }
        } catch {
          setError("Received an invalid response from the audio service.");
        }
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          stopStream();
        }
      });
      socket.addEventListener("error", () => {
        setError("The audio service connection encountered an error.");
      });

      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      nodesRef.current.push(source, analyser);

      const worklet = new AudioWorkletNode(
        audioContext,
        "pcm-worklet-processor",
        { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] },
      );
      const silentOutput = audioContext.createGain();
      silentOutput.gain.value = 0;
      worklet.port.onmessage = (event: MessageEvent<unknown>): void => {
        if (
          typeof event.data === "object" &&
          event.data !== null &&
          "type" in event.data &&
          event.data.type === "error" &&
          "message" in event.data &&
          typeof event.data.message === "string"
        ) {
          setError(event.data.message);
          stopStream();
          setStatus("error");
          return;
        }
        if (!(event.data instanceof ArrayBuffer)) {
          return;
        }
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };
      source.connect(worklet);
      worklet.connect(silentOutput);
      silentOutput.connect(audioContext.destination);
      nodesRef.current.push(worklet, silentOutput);

      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error("The audio service disconnected during setup.");
      }
      const waveform = new Float32Array(analyser.fftSize);
      let animationFrame = 0;
      const updateWaveform = (): void => {
        if (audioContext.state === "closed" || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        analyser.getFloatTimeDomainData(waveform);
        setWaveformData(waveform.slice());
        animationFrame = window.requestAnimationFrame(updateWaveform);
      };
      animationFrame = window.requestAnimationFrame(updateWaveform);
      worklet.addEventListener("processorerror", () => {
        window.cancelAnimationFrame(animationFrame);
        setError("Audio processing stopped unexpectedly.");
        stopStream();
        setStatus("error");
      });
      setStatus("streaming");
    } catch (caughtError: unknown) {
      stopStream();
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start microphone streaming.";
      setError(message);
      setStatus("error");
    }
  }, [sessionId, status, stopStream]);

  useEffect(() => releaseResources, [releaseResources]);

  return {
    startStream,
    stopStream,
    isStreaming: status === "streaming",
    sessionId,
    status,
    error,
    lastResult,
    waveformData,
  };
}
