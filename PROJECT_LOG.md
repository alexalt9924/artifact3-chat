# Artifact 3: project log

High-level summary of what was planned and built, October 2026.

## Goal
Serve a locally hosted language model to several users at once through an OpenAI-style API, with the GPU's
throughput shared between them. The API runs in Docker on a home machine and is reached through a Cloudflare tunnel.
A static, password-protected chat site on GitHub Pages talks to it.

## Plan
1. **API:** use an existing project (`llama.cpp` `llama-server`), dockerized, on a private Docker network.
2. **Frontend:** Vite + React + TypeScript chat UI in a Claude.ai-like style, one shared password, static build for GitHub Pages.
3. **Tunnel:** Cloudflare tunnel (`cloudflared`) in front of the API, so no ports are opened on the home network.

Decisions: one RTX 4070 (12 GB), 8 concurrent slots x 4,096 tokens each, Vite + React + TS frontend.

## Architecture
```
Browser (GitHub Pages) --HTTPS--> Cloudflare --tunnel--> cloudflared
        --private Docker network--> llama-server (GPU)
```
- API and tunnel configs live on the host and are not part of this repository.
- This repository holds the frontend (`frontend/`) and its deploy workflow (`.github/workflows/deploy-frontend.yml`).
- Site: https://alexalt9924.github.io/artifact3-chat/

## What was done
1. **Environment:** got Docker to see the GPU (a typo in the host's NVIDIA container toolkit setting).
2. **API:** llama-server container with 8 parallel slots, continuous batching, full GPU offload, API-key auth, `--jinja` templates.
   Image pinned by digest.
3. **Bugs found while testing:**
   - llama-server reads the key from `LLAMA_API_KEY`, not `LLAMA_ARG_API_KEY`. With the wrong name, auth is silently off. Fixed.
   - The first model (Gemma 4 E4B) "thinks" by default, which wastes tokens and context. Turned reasoning off.
4. **Throughput test (first model):** 1 user ~110 tok/s. 8 users ~437 tok/s total, ~56 each. A 9th request queued about
   3.7 s, then ran at full speed.
5. **Frontend:** login screen, streaming chat with markdown and code copy, conversation sidebar, light/dark, mobile layout,
   stop button, context trimming to fit the 4K slot.
6. **Tunnel:** cloudflared stack started and joined to the API's network; auth, CORS and streaming verified end to end.
7. **GitHub Pages:** public repo, Pages deployed via Actions, API URL supplied as a build variable.
8. **Security hardening:**
   - Container: non-root, all capabilities dropped, `no-new-privileges`, read-only root filesystem and weights,
     memory/CPU/PID limits, no Docker socket, no published host port.
   - Network: the API's network is internal-only; only cloudflared has outbound access.
   - App: llama-server's `/slots` endpoint disabled (it exposes other users' prompts), CORS limited to the Pages origin.
   - Frontend: Content-Security-Policy that blocks external images, so model output can't exfiltrate chat content.

## Model switch: 12B conversational finetune (2026-10-25)
- Replaced Gemma 4 E4B with a 12B LoRA finetune of a Gemma base, quantized to Q4_K_M (~7.3 GB).
  The GGUF has no embedded chat template, so the server loads the training template (Gemma 3 turn format)
  plus a system prompt from a separate Jinja file.
- VRAM: an f16 KV cache for 8 x 4K would need ~4.7 GB on top of the weights, so the KV cache is 8-bit (~2.4 GB).
- Host RAM: this llama.cpp build defaults to 32 sliding-window checkpoints per slot and an 8 GB prompt cache, so these are
  capped with `--ctx-checkpoints 2` and `--cache-ram 2048`.
- Measured, 8 slots x 4,096: 1 user ~52 tok/s. 8 users with short prompts ~27 tok/s each (~220 total). 8 users with
  ~3.4K-token prompts: min 17.6, avg 21.7 tok/s each. VRAM peak ~11.6 of 12 GB.
- Frontend: the model is labeled "Artifact 3". Context per chat is unchanged (4,096).
- The model isn't safety-tuned. It follows the system prompt's identity, but refusals are less reliable than with Gemma 4.
- System prompt rewritten in plain text. The model was copying the prompt's markdown (headings, **bold**, bullets) into
  its replies, because Gemma 3's format puts the system prompt inside the first user message. Markdown is now limited to
  code and requested lists/tables, and CAPS replace bold. Across 5 test questions, bold and headings went from 11 and 4 to 0.
  Still seen: some emoji, an occasional recited prompt, and now and then a different self-name.
