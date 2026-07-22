# Project Interview Summaries

Interview-ready technical overviews of six projects: **StratoSort Core, Odta, Rephrame, Norklar, SCANUE-V22, and STAC.** Each entry gives you a 30-second pitch, a high-level description, the technical stack, the architecture and design decisions, and a set of talking points (with the trade-offs and challenges an interviewer will probe).

---

## Portfolio narrative (say this first)

Before drilling into any single project, it helps to frame the whole body of work with one thread, because five of the six share it:

> "Most of my work is about running AI **where the data lives** — on the user's own device — instead of shipping their data to a cloud API. I've done that across every form factor: an Electron desktop app, a Flutter mobile app, browser-based PWAs, and down at the research layer where I've looked at what it takes to make the models themselves cheaper to run. The sixth project is a multi-agent reasoning system. So the portfolio is really 'privacy-first, on-device AI' explored top to bottom — product, platform, and the model internals."

That single sentence lets an interviewer pick any thread and pull. The projects below are ordered so you can tell that story: three shipped **products** (StratoSort, Odta, Rephrame, Norklar), then two **research/systems** projects (SCANUE-V22, STAC).

The recurring engineering themes to keep in your pocket:

- **Local-first / offline-first as an architecture, not a feature flag** — "there is no cloud toggle to turn off, because there is no cloud layer."
- **Model distribution and integrity** — how you get multi-gigabyte weights onto a device without accounts, tokens, or a backend, and verify them.
- **Hardware-aware inference** — GPU auto-detection, WebGPU→WASM fallback, INT4 quantization, CPU backends.
- **Graceful degradation** — the app has to work when the network, the GPU, or the model isn't there.
- **Trust and safety by construction** — privacy guarantees you can point to in the code, not the marketing.

---

## 1. StratoSort Core

**Repo:** `iLevyTate/StratoSortCore` (Electron / React / Node) · **Site:** stratosort.com

### 30-second pitch
"StratoSort is a privacy-first desktop app that turns file chaos into an organized, searchable knowledge base — entirely on your own machine. It reads the *content* of your documents, images, audio, and video with local AI, lets you search by meaning and chat with your files, and auto-routes new files into smart folders. Nothing leaves your hardware. It's aimed at professionals — lawyers, clinicians, anyone under HIPAA/FERPA/CJIS-type constraints — who literally cannot hand their files to a cloud service."

### What it does (high level)
- **Semantic search** — find files by meaning, not filename. "non-compete clause" surfaces the right contract even if those words aren't in the name.
- **Document chat (RAG)** — ask questions in plain language; it retrieves relevant context from *your* documents and generates grounded answers.
- **Knowledge graph** — visualizes how documents relate: clusters, connections, semantic neighborhoods.
- **File routing / automation** — you define categories in plain language once; new files are read in the background, classified, and moved automatically, with full undo/redo and a reviewable action history.
- **Multi-modal ingest** — text, images (vision + OCR for receipts/screenshots/scanned PDFs), and audio/video (local Whisper transcription indexed alongside documents).

### Technical stack
- **Shell:** Electron (Windows / macOS / Linux desktop).
- **UI:** React + Tailwind CSS.
- **Local inference:** `node-llama-cpp` running **GGUF** quantized models on-device (with GPU auto-detection); Whisper for local speech-to-text; a vision/OCR path for images.
- **Vector layer:** **Orama** for on-device embeddings/vector search (an earlier iteration used ChromaDB — worth mentioning as an evolution).
- **Retrieval:** local RAG pipeline — chunk → embed → store → retrieve → ground the LLM answer.

### Architecture & key design decisions
- **Privacy is structural, not a setting.** The strongest line: "There is no toggle to turn off cloud sync. There is no cloud layer." Document understanding, the search index, and file actions all live inside one desktop workflow on the user's hardware. This is a *design constraint that drove every downstream choice*, not a marketing claim.
- **Electron + native inference bindings.** Choosing Electron gave cross-platform reach and a React UI, but the interesting engineering is bridging JS/Electron to native `llama.cpp` (via `node-llama-cpp`) so a non-technical user gets local LLM inference with **no Python, Docker, API keys, or terminal** — "one installer."
- **Model-profile onboarding.** On first launch the user picks a quality tier; the app downloads models (2–5 GB, one time) and auto-detects the GPU. This hides the hardest part of local AI (model management, hardware variance) behind three steps.
- **Reversibility as a trust mechanism.** Because the app *moves and renames real files*, every action is reversible with a reviewable history — a preview-before-apply/undo philosophy rather than a destructive "fix it for me" button.

### Interview talking points & trade-offs
- **Why local over cloud?** Regulated professions (attorney-client privilege, HIPAA/FERPA/CJIS/ITAR/SOC 2). The pitch is risk-avoidance: 68% of orgs have had data leaked via employees pasting into AI tools; you remove the exfiltration path entirely.
- **The hard trade-off:** local models are smaller/weaker than frontier cloud models, and you inherit the user's hardware variance. Talk about how quantization (GGUF), GPU auto-detection, and tiered model profiles manage that — you're trading raw capability for privacy + zero marginal cost + offline availability.
- **RAG grounding:** how you keep answers tied to the user's documents (retrieval + citations) rather than hallucinating.
- **Multi-modal indexing at rest** on a laptop is a real systems problem — background processing, incremental indexing as files arrive, keeping the UI responsive.
- **Distribution:** getting several GB of weights and native binaries onto three OSes without a backend.

---

## 2. Odta

**Repo:** `iLevyTate/Odta` (Vanilla JS PWA)

### 30-second pitch
"Odta is a local-first task and time manager — think Pomodoro timer plus a ClickUp-style task app — supercharged by *ambient* on-device AI. It runs entirely in the browser with no accounts, no server, no telemetry, and no build step. The AI is deliberately embedding-based rather than generative: it understands your tasks semantically to power search and suggestions, and it works fully offline."

### What it does
- Nested subtasks with statuses (Open / In Progress / Review / Blocked / Done).
- Pomodoro focus/break cycles, stopwatch, quick timers.
- **Semantic search & task suggestions** via on-device embeddings + cosine similarity.
- **Impact scoring** using a Pareto 80/20 model (priority, due-date urgency, unblocking relationships, inverse effort).
- Natural-language quick-add with date parsing, bulk-paste import, read-only iCal/ICS calendar feeds.
- Optional peer-to-peer sync (WebRTC), installable PWA, full keyboard nav / accessibility.

### Technical stack
- **Vanilla JavaScript — no framework, no bundler, no transpiler.** Modules load sequentially from `index.html`.
- **Storage:** IndexedDB. **Offline:** Service Worker.
- **AI:** Transformers.js v3.3.1 running `Xenova/bge-small-en-v1.5` (~33 MB, 384-dim sentence encoder), **WebGPU when available, WASM fallback**.
- **Optional generative "Ask":** opt-in, hidden by default; user can download a small SmolLM2/Qwen model (~135–230 MB) for conversational planning.
- **Dates:** chrono-node. **P2P:** PeerJS. All dependencies **vendored** under `js/vendor/` — no CDN for the app shell.

### Architecture & key design decisions
- **"No build step" as a philosophy.** Zero bundler/transpiler means the app is auditable, dependency-light, and can even run from `file://`. This is a strong, defensible engineering opinion to discuss.
- **Embeddings over generation.** The deliberate choice: the *primary* AI layer is a semantic encoder, not an LLM. Embeddings are small, fast, deterministic-ish, and privacy-safe; generation is the experimental, opt-in extra. Great example of "use the smallest model that solves the problem."
- **Vendoring for zero-network builds.** `npm run fetch-models` commits weights locally so there's no runtime CDN dependency — real local-first, not "local-ish."
- **Preview-before-apply** rather than destructive automation — same trust philosophy as StratoSort.

### Interview talking points & trade-offs
- **Why vanilla JS in 2025/26?** Auditability, longevity, no toolchain rot, tiny footprint — versus losing framework ergonomics and component reuse. Be ready to defend it.
- **WebGPU→WASM fallback** is a concrete browser-inference engineering detail: you detect capability at runtime and degrade gracefully.
- **Embedding-based UX:** how cosine similarity over a 384-dim space actually produces "smart" search/suggestions without an LLM — and where that breaks down (embeddings can't reason or plan, hence the optional generative layer).
- **P2P sync without a server** (WebRTC/PeerJS): last-write-wins conflict handling, pairing as a shared secret.

---

## 3. Rephrame

**Repo:** `iLevyTate/Rephrame` (Vanilla JS PWA)

### 30-second pitch
"Rephrame is a private, offline-first cognitive behavioral therapy journal you install to your home screen and run as a local app — no account, no server, no analytics. It implements real, evidence-based CBT workflows (thought records, behavioral activation, worry postponement) with safety gating built in, and it can run entirely from a local file for maximum privacy."

### What it does — four capture modes
- **Thought record** — the 7-step *Mind Over Mood* workflow (situation → emotion → automatic thought → evidence → balanced thought).
- **Free write** — unstructured journaling.
- **Activity planning** — behavioral activation with predicted-vs-actual pleasure/mastery ratings.
- **"Park a worry"** — worry postponement via the Borkovec technique.
- Plus: 30-second quick-capture, coping cards (pinned reframes as a carousel), scope filters (by type, week, distortion), a **patterns dashboard** (recurring distortions, mood shifts, activity heatmap), and JSON import/export + print-to-PDF.

### Technical stack
- **Vanilla HTML/CSS/JS**, single-page app.
- **Storage:** browser `localStorage` (entries, settings, PIN hash).
- **PWA:** service worker for offline + auto-update.
- **Optional sync:** device-to-device P2P via WebRTC/PeerJS.
- **No ML / no external APIs** beyond STUN servers for WebRTC NAT traversal. Google Fonts cached lazily with a 1.5s fallback to system fonts if offline.

### Architecture & key design decisions
- **Clinical grounding drives the UX.** Every capture mode maps to a named, evidence-based CBT technique — this isn't a generic journal with a theme. Worth emphasizing: domain research shaped the product.
- **Safety by construction.** A grounding prompt surfaces automatically at emotional intensity ≥ 80; a "these thoughts feel accurate" tile lets users opt out of distortion-framing; crisis resources are embedded and explicitly scoped for ordinary distress. Designing for a vulnerable user is a strong, mature talking point.
- **Privacy hard-lines.** Optional PIN lock (4–8 digits, **SHA-256 hashed, device-only, no recovery**); runs from `file://`; no telemetry. The "no PIN recovery" decision is a deliberate privacy-vs-convenience trade-off you can defend.
- **Offline-first degradation** — font fallback, undo toast (6s window) for deletions, last-write-wins sync.

### Interview talking points & trade-offs
- **Ethics & responsibility** in a mental-health tool: safety gating, crisis resourcing, and being explicit about what the tool is *not* (not a therapist, for ordinary distress).
- **Privacy vs. recoverability:** no account means no password reset — you chose to let users lose data rather than hold a recovery key. That's a real product decision.
- **Why no AI here (contrast with Odta):** a CBT journal's value is in structured human reflection; injecting an LLM could be counter-therapeutic or unsafe. Knowing *when not to use AI* is a senior signal.
- **PWA mechanics:** service-worker caching/auto-update, installability, the font-fallback timing.

---

## 4. Norklar

**Repos:** `iLevyTate/StratoLens` (app, Flutter/Dart, private) + `iLevyTate/norklar-models` (public model mirror)

### 30-second pitch
"Norklar is an on-device AI app for mobile — built in Flutter — that runs Google's Gemma 2B model locally, with no cloud, no account, and no token. Everything runs on the phone. A lot of the interesting engineering is the *model-distribution* problem: how do you get a 1.35 GB quantized model onto a device reliably, verify its integrity, and do it without a backend or forcing users through a Hugging Face login."

### What it does
On-device conversational/generative AI on mobile — the model runs entirely locally so prompts and outputs never leave the device. (StratoLens is the private app repo; the public `norklar-models` repo is the piece that solves distribution.)

### Technical stack
- **App:** Flutter / Dart (cross-platform mobile).
- **Model:** **Gemma 2B Instruction-tuned**, INT4-quantized, in **LiteRT `.task`** format (`gemma-2b-it-cpu-int4.task`, ~1.35 GB) — the format consumed by the MediaPipe / LiteRT LLM Inference stack, CPU backend.
- **Distribution:** models hosted as **GitHub release assets** (public mirror) to eliminate account/token requirements; **SHA-256 digest verification** after download for integrity.
- **Licensing handled explicitly:** redistributes unmodified Gemma under §3 of the Gemma Terms of Use, with the Prohibited Use Policy surfaced; "not affiliated with or endorsed by Google."

### Architecture & key design decisions
- **The model-distribution problem is the story.** Shipping a >1 GB model to phones without a backend: host on GitHub Releases (no auth), verify with SHA-256 (integrity + tamper-evidence), download once and cache. This is a genuinely non-obvious systems problem and a great whiteboard topic.
- **INT4 + CPU backend** so it runs on commodity phones without a dedicated NPU/GPU path — a deliberate reach-over-peak-quality choice.
- **Licensing as an engineering concern.** Redistributing a third-party model correctly (Gemma Terms §3, Prohibited Use Policy, non-affiliation disclaimer) shows you think about the legal surface of ML, not just the code.

### Interview talking points & trade-offs
- **On-device LLM on a phone:** memory pressure, load-time latency, quantization quality loss (INT4), and why you accept them for privacy + offline.
- **No-backend distribution:** trade-offs of GitHub Releases as a CDN (bandwidth, versioning) vs. standing up your own infra; why SHA-256 verification matters when you don't control the transport.
- **Flutter for AI:** bridging Dart to native on-device inference (MediaPipe/LiteRT), cross-platform from one codebase.
- Be candid that the app repo is private; lead with the distribution/integrity design and the on-device inference story, which are the transferable parts.

*(Note: Norklar's exact end-user feature set lives in the private StratoLens repo — fill in the specific user-facing function from your own notes; the verifiable technical story above is the model, format, on-device inference, and distribution design.)*

---

## 5. SCANUE-V22

**Repo:** `iLevyTate/scanue-v22` (Python) · part of a longer "SCAN" research line

### 30-second pitch
"SCANUE-V22 is a brain-inspired multi-agent reasoning system. It models the prefrontal cortex as a team of specialized agents — one for executive control, one for risk/emotion, one for reward evaluation, one for conflict detection, one for value-based decision-making — and orchestrates them with LangGraph. A controller agent decides which specialists a given task actually needs, they run, and a synthesis agent combines their outputs. It's a structured, cognitively-grounded alternative to throwing everything at a single monolithic LLM prompt."

### What it does — the cognitive architecture
Five "PFC region" agents:
- **DLPFC** — task delegation & executive control (the router/orchestrator).
- **VMPFC** — emotional regulation & risk assessment.
- **OFC** — reward processing & outcome evaluation.
- **ACC** — conflict detection & error monitoring.
- **MPFC** — value-based decision-making & final synthesis.

**Workflow:** user submits a task → DLPFC analyzes it and decides which specialists are needed → only the delegated agents activate → MPFC synthesizes into a final response → optional human-in-the-loop feedback persists to `feedback_history.json`.

### Technical stack
- **Python 3.11+**, **LangGraph** for stateful workflow orchestration.
- **Model-agnostic:** OpenAI, **Ollama (local)**, and HuggingFace (endpoint/TGI) providers, configured **per-agent** via YAML (each agent can use a different model/provider).
- Human-in-the-loop feedback loop, per-run session logging (gitignored), interactive and one-shot CLI modes, pytest suite.

### Architecture & key design decisions
- **Conditional routing, not fixed pipeline.** DLPFC decides which agents fire, so a simple task doesn't pay for all five. This is the core efficiency idea and maps cleanly onto LangGraph's conditional edges.
- **Per-agent model configuration.** Different cognitive roles have different needs — you can put a cheap local model on conflict-checking and a stronger one on synthesis. Good cost/quality-routing talking point.
- **Biological metaphor as a design discipline.** The PFC mapping isn't just branding; it gives each agent a *bounded responsibility*, which makes the system decomposable, testable, and explainable — the opposite of one giant prompt.
- **Human-in-the-loop** feedback persistence to refine behavior over time.

### Interview talking points & trade-offs
- **Multi-agent vs. single-prompt:** you trade latency and orchestration complexity for decomposition, explainability, and targeted routing. Be ready to argue when that's worth it (complex, multi-faceted decisions) and when it's over-engineering (simple Q&A).
- **LangGraph specifics:** state passing between nodes, conditional edges, why a graph over a chain.
- **Provider abstraction:** supporting cloud + local (Ollama) behind one interface, and why local matters for the same privacy reasons as the product work.
- **Evaluation is the hard part:** how do you know the multi-agent decomposition actually beats a baseline? (A fair interviewer will push here — acknowledge it's a research system and talk about the feedback loop.)
- **Lineage:** this sits in a multi-version research line (SCAN → SCANUE → V22), so you can speak to iteration and what each version changed.

---

## 6. STAC

**Repo:** `iLevyTate/stac` (Python) — *Spiking Transformer Augmenting Cognition*

### 30-second pitch
"STAC is a research project on making language models radically more energy-efficient by running them as **spiking neural networks** instead of dense transformers. It has two tracks: one trains a spiking language model from scratch with biologically-realistic adaptive neurons, and the other **converts existing pretrained transformers** — DistilGPT-2, SmolLM2-1.7B — into spiking networks while preserving multi-turn conversational ability. It's the lowest-level, most research-y thing I've built: instead of running models efficiently, I'm asking whether the model *computation itself* can be cheaper."

### What it does — two branches
- **STAC V1 — train from scratch:** end-to-end pipeline built on learnable **Adaptive Exponential (AdEx)** neurons, a **Hyperdimensional Memory Module**, and surrogate-gradient training on WikiText-2.
- **STAC V2 — convert pretrained models:** takes DistilGPT-2 / SmolLM2-1.7B-Instruct and converts them to SNNs. Pipeline: **substitute GELU→ReLU**, quantize, then apply SpikingJelly's `ann2snn` conversion. A **Temporal Spike Processor** maintains multi-turn context by tracking spike patterns across timesteps and managing KV-cache behavior.

### Technical stack
- **Python**, **SpikingJelly** (SNN framework) with a cross-version compatibility layer, PyTorch-family model handling.
- Spike-count telemetry/instrumentation hooks, position-ID & attention-mask validation, KV-cache handling for sequential generation, an optional **Intel Loihi** export path.
- Test infra: multi-turn conversation smoke tests, position-boundary checks, attention-mask verification, energy-estimation routines.

### Architecture & key design decisions
- **Two complementary strategies** (train-from-scratch vs. convert-pretrained) hedge the research bet: conversion is pragmatic and reuses billions of dollars of pretraining; from-scratch explores what's possible with truly neuromorphic primitives.
- **ANN→SNN conversion mechanics:** GELU→ReLU substitution + quantization are prerequisites for `ann2snn` — a concrete, explainable technical detail that shows you understand *why* the conversion needs them.
- **The temporal problem:** transformers are sequence models; SNNs are temporal/event-driven. The Temporal Spike Processor reconciling KV-cache with spike timesteps is the crux novel piece.
- **Intellectual honesty built into the repo.** The README explicitly states: *"This repository currently runs software-level SNN simulations only… Energy figures reported here are theoretical projections derived from spike-count analysis, not measured hardware data."* Leading with your own limitation is a huge credibility signal in an interview.

### Interview talking points & trade-offs
- **Why SNNs?** Event-driven, sparse computation → potentially orders-of-magnitude lower energy on neuromorphic hardware (Loihi). Ties back to the on-device theme: cheaper computation is what makes local AI viable long-term.
- **The honest caveat, stated first:** simulation-only, projected (not measured) energy. Say this before they ask — it disarms the obvious critique and shows research maturity.
- **Accuracy vs. efficiency trade-off:** conversion to spikes generally costs some quality; the interesting question is how much, and whether multi-turn coherence survives (your smoke tests target exactly this).
- **Surrogate gradients / AdEx neurons:** be ready to explain why SNNs are hard to train (non-differentiable spikes) and how surrogate gradients get around it.
- **Depth signal:** this is the project that proves you can go below the API line into model internals and neuromorphic computing — pair it with the product work to show range from shipping UX to research.

---

## Quick-reference matrix

| Project | Type | Platform / Stack | AI approach | Headline design decision |
|---|---|---|---|---|
| **StratoSort Core** | Product | Electron + React desktop | Local RAG: GGUF LLM (`node-llama-cpp`), Whisper, Orama vectors | No cloud layer *at all*; reversible file actions |
| **Odta** | Product | Vanilla-JS PWA | On-device embeddings (Transformers.js, bge-small), opt-in tiny LLM | No build step; embeddings-over-generation; vendored deps |
| **Rephrame** | Product | Vanilla-JS PWA | *No AI by design* | Evidence-based CBT + safety gating; runs from `file://` |
| **Norklar** | Product | Flutter / Dart mobile | On-device Gemma 2B (INT4, LiteRT) | Backend-free model distribution + SHA-256 integrity |
| **SCANUE-V22** | Research/systems | Python + LangGraph | Multi-agent LLM orchestration (cloud + Ollama) | PFC-mapped agents with conditional routing |
| **STAC** | Research | Python + SpikingJelly | Transformer→spiking-neural-net conversion | Two-track (scratch + convert); honest sim-only caveat |

---

## Cross-cutting questions you'll likely get (and good answers)

- **"Why are you so focused on local/on-device?"** — Privacy, regulatory exposure, zero marginal inference cost, offline availability, and no vendor lock-in of institutional memory. For regulated users it's not a preference, it's a requirement.
- **"What's the hardest part of on-device AI?"** — Not the inference call; it's everything around it: model distribution & integrity at gigabyte scale, hardware variance (GPU/NPU detection, quantization, CPU fallback), keeping the UX responsive during background indexing/inference, and graceful degradation.
- **"Where does local AI fall short vs. cloud?"** — Model capability ceiling and hardware ceiling. Answer with your mitigations: quantization, tiered model profiles, embeddings-first design, and choosing the smallest model that solves the problem.
- **"Show me you know when *not* to use AI."** — Rephrame. A CBT journal's value is structured human reflection; an LLM there could be unsafe or counter-therapeutic. Restraint is a design decision.
- **"How do you evaluate these?"** — Be honest per project: products lean on user-facing correctness (RAG grounding, undo/redo, smoke tests); the research projects (SCANUE, STAC) are earlier-stage — talk about feedback loops, smoke tests, and the limitations you've documented rather than overclaiming.
