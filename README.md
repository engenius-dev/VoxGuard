# 🛡️ VoxGuard: Real-Time Voice Integrity & Deepfake Detection Platform

VoxGuard is an end-to-end, real-time audio analysis pipeline designed to detect AI-synthesized voices, deepfakes, and vocal impersonation attempts. Built with a modern microservices architecture, it streams raw PCM audio from a React frontend to a FastAPI AI engine, computes a Dynamic Impersonation Risk Index (DIRI) using an AASIST Graph Attention Network, and logs forensic telemetry to a Node.js/MongoDB SIEM gateway.

## 🎯 System Architecture

The pipeline operates on a high-throughput, zero-disk-retention microservices model prioritizing clean, self-contained execution logic:

1. **Frontend (React/Vite):** Captures microphone audio using HTML5 `AudioWorklet`. Enforces a strict 16kHz `AudioContext` to prevent resampling aliasing, quantizes directly to 16-bit PCM, slices it into 20ms frames, and streams it via binary WebSockets.
2. **AI Gateway (FastAPI):** Receives the WebSocket stream and maintains an ephemeral **4-second sliding window** in a Redis RAM buffer. It utilizes an RMS-based Voice Activity Detection (VAD) gate to seamlessly bypass inference during silence and room noise.
3. **DSP & Inference Engine (PyTorch):** Bypasses standard spectrograms to feed raw PCM audio directly into a Sinc-convolutional front-end. It runs the pre-trained official **AASIST-L Graph Attention Network** to generate real-time raw authenticity scores.
4. **SIEM Audit Server (Express):** Tracks the *peak* threat score over the duration of the stream. Upon WebSocket termination, FastAPI makes a single HTTP POST request to the Express server, which uses `findOneAndUpdate` (upsert) to persist exactly one clean forensic document per session to MongoDB.

## 🛠️ Tech Stack

**Frontend (Security Dashboard)**
* React 18, TypeScript, Vite
* HTML5 Audio API & AudioWorklet (Native 16kHz processing)
* Lucide React (Icons)

**AI Backend (Ingestion & DSP)**
* Python 3.11+, FastAPI, Uvicorn
* PyTorch, Torchaudio
* Redis (Volatile Sliding Buffer)

**Audit Gateway (Telemetry & Storage)**
* Node.js, Express, TypeScript
* MongoDB, Mongoose

## 📂 Project Structure

```text
VoxGuard/
├── backend/               # Python FastAPI Gateway, DSP & PyTorch Engine
│   ├── app/               # Core routing, Websockets, Models, and DSP logic
│   ├── weights/           # Pre-trained AASIST-L.pth models (Git-ignored)
│   └── requirements.txt
├── dashboard-server/      # Node.js SIEM Audit Gateway
│   ├── src/               # Express routes, Mongoose schemas, WS Relays
│   └── package.json
└── frontend/              # React UI (Audio Capture & Security Dashboard)
    ├── public/            # audio-worklet-processor.js
    ├── src/               # React components (AuthenticityMeter, LiveWaveform)
    └── package.json
```

## ⚙️ Prerequisites

Ensure your system meets the following requirements before local deployment:
* Node.js (v20+ recommended)
* Python (v3.11+)
* MongoDB (Running natively on Windows port 27017)
* Redis (Running via WSL/Linux on port 6379)

## 🚀 Installation & Setup

Clone the repository and set up the microservices independently:

```sh
git clone https://github.com/engenius-dev/VoxGuard.git
cd VoxGuard
```

1. **AI Backend (FastAPI)**

```sh
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Download the pre-trained AASIST-Lite model weights
mkdir weights
Invoke-WebRequest -Uri "https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST-L/resolve/main/AASIST-L.pth" -OutFile "weights\aasist_lite.pt"
```

2. **SIEM Audit Server (Express)**

```sh
cd ../dashboard-server
npm install
```

3. **Frontend Dashboard (React)**

```sh
cd ../frontend
npm install
```

## 🏃‍♂️ Running the Pipeline

To run the application locally, you will need 4 separate terminal tabs.

### Terminal 1: Start Redis (Kali WSL)

```sh
wsl -d kali-linux
service redis-server start
redis-cli ping # Ensure it responds with PONG. Keep this terminal open.
```

### Terminal 2: Start the AI Backend

```sh
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

### Terminal 3: Start the Audit Gateway

```sh
cd dashboard-server
npm run dev
# Expected output: VoxGuard Audit Server listening on port 5000
```

### Terminal 4: Start the Frontend

```sh
cd frontend
npm run dev
# Navigate to http://localhost:5173
```

## 📡 API Documentation

### WebSocket Ingestion (FastAPI)

* **URL:** ws://localhost:8000/ws/ingest/{session_id}
* **Protocol:** Binary ArrayBuffer
* **Description:** Receives 20ms PCM audio chunks, calculates 4-second sliding windows, and returns live JSON threat scores.

### REST Telemetry (Express)

* **Endpoint:** POST /api/v1/alerts
* **Content-Type:** application/json
* **Payload Schema:**
```json
{
  "timestamp": "2026-11-01T22:00:00.000Z",
  "session_id": "uuid-string",
  "diri_score": 96.4,
  "status": "CRITICAL_THREAT",
  "model_confidence": 0.964
}
```

---

## 👨‍💻 Contributing

Designed and maintained by @engenius-dev for real-time cyber-physical security integrations ✨.