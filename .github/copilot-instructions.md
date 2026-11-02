# VoxGuard — GitHub Copilot Workspace Instructions

You are acting as an expert Lead AI & Cybersecurity Architect building **VoxGuard**, an inline, real-time AI voice impersonation and cloning defense framework. Adhere strictly to the project architecture, tech stack standards, and security constraints outlined below.

---

## 1. Core Constraints & Security Policies

1. **Zero-Disk Audio Retention (Privacy Policy):**
   - **NEVER** write raw PCM, spectrograms, or audio arrays to disk or persistent storage.
   - All client audio processing must occur strictly in volatile RAM (via Redis sliding buffers or Python memory arrays) with a maximum lifetime of 500ms.
   - Only log anonymized metadata (timestamps, session IDs, DIRI scores, model confidence) to MongoDB.

2. **Ultra-Low Latency & Performance Target:**
   - Inference and risk scoring must execute in **< 150ms** processing time per frame.
   - Use async processing in Python (`asyncio`, `FastAPI` WebSockets) and optimized matrix transformations (`PyTorch`, `Torchaudio`).

3. **No Deprecated Syntax & Warnings:**
   - **Python/FastAPI:** Do NOT use `@app.on_event("startup")` or `@app.on_event("shutdown")`. Use modern `lifespan` async context managers (`contextlib.asynccontextmanager`). Use `pydantic-settings` for config management.
   - **React/TypeScript:** Do NOT use Class Components or `any` types. Use functional components with strict TypeScript interface definitions (`interface` / `type`).
   - **Node.js/Express (TS):** Use ESM syntax (`import`/`export`), strict Mongoose typing, and explicit return types.

---

## 2. Tech Stack Specifications

### A. Python Backend (`/backend`)
- **Language:** Python 3.11+
- **Framework:** FastAPI, WebSockets (`wss://`)
- **State Management:** Redis (Volatile ephemeral memory sliding buffer)
- **DSP & AI:** `torchaudio`, `librosa`, `torch` (PyTorch 2.x), AASIST, Wav2Vec 2.0
- **Rule:** Write modular, type-hinted code using standard Python typing (`dict[str, Any]`, `list[float]`, etc.).

### B. Express Audit Server (`/dashboard-server`)
- **Language:** TypeScript 5.x (Node.js)
- **Framework:** Express.js, `ws` (WebSocket server)
- **Database:** MongoDB via `mongoose` (Audits & SIEM Telemetry)
- **Rule:** Keep strict boundaries between routes, controllers, and models. Define all payload interfaces in `src/types/telemetry.ts`.

### C. Frontend Security Dashboard (`/frontend`)
- **Language:** TypeScript 5.x, React 18+ (Vite)
- **Audio Capture:** HTML5 Web Audio API using native `AudioWorkletProcessor` (20ms PCM frame slicing at 16kHz mono).
- **Styling & UI:** Modern responsive layout, visual risk gauge (0–100%), live waveform canvas, and real-time alert banners.
- **Rule:** Never use inline `any`. Export all data types from `src/types/index.ts`.

---

## 3. Directory Structure Enforcement

Respect the existing modular repository layout:
- `backend/app/api/websockets/ingest.py`: WebSocket endpoint receiving 20ms binary PCM chunks.
- `backend/app/dsp/`: Spectrogram extraction (STFT, CQT, MFCCs).
- `backend/app/models/`: AASIST and Wav2Vec 2.0 PyTorch inference execution.
- `backend/app/services/diri_engine.py`: Rolling 3–5 second window Dynamic Impersonation Risk Index calculation.
- `dashboard-server/src/`: Express REST API & alert relay server.
- `frontend/src/`: React UI components & Web Audio API hooks.

---

## 4. Code Quality & Output Rules

- **Self-Contained & Production-Ready:** Provide complete code blocks without placeholders, missing imports, or truncated `// TODO` sections.
- **Error Handling:** Gracefully handle dropped WebSocket connections, Redis reconnection failures, and invalid audio buffer shapes.
- **Strict Typing:** Always declare function parameters, return values, state types, and API payloads explicitly.