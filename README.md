# Artifact 3 Chat

A small chat app for a language model hosted at home on a single GPU.
Live site: https://alexalt9924.github.io/artifact3-chat/ (password protected)

## Model
- **Base:** a conversational finetune of a 12B Gemma model
- **Quantization:** Q4_K_M (4-bit, ~7.3 GB)
- **Hardware:** runs locally on one NVIDIA RTX 4070 (12 GB), not in the cloud
- **Server:** [llama.cpp](https://github.com/ggml-org/llama.cpp) `llama-server` in Docker, OpenAI-compatible API, reached through a Cloudflare tunnel
- **Capacity:** 8 concurrent users, 4,096 tokens of context each (8-bit KV cache)
- **Speed:** ~52 tokens/s for a single user, about 18–27 tokens/s per user with all 8 slots busy

### The challenge: the conversational finetune
The finetune changes how the model talks, and getting it to behave in a chat app took work:
- The weights ship without a chat template, so the server supplies the training template (Gemma 3 turn format).
- That format puts the system prompt inside the first user message, so the model copied the prompt's markdown style
  into its replies. The system prompt was rewritten in plain text, which removed nearly all of it.
- It still sometimes uses emoji, recites part of its prompt, or calls itself by a different name.
- It is not safety-tuned and is often wrong. Treat it as a toy to experiment with.

## Frontend
- Vite + React 19 + TypeScript, built to static files and deployed to GitHub Pages by GitHub Actions
- Claude.ai-inspired layout with light and dark themes and a mobile layout
- Streaming replies with a stop button, markdown (GFM) rendering, syntax highlighting and code copy
- Conversation sidebar; chats are stored only in your browser (`localStorage`)
- Context meter that tracks the 4,096-token limit and trims old messages so a chat fits its slot
- Content-Security-Policy that blocks external images and scripts

## Running the frontend
```sh
cd frontend
cp .env.example .env   # set VITE_API_URL to your own OpenAI-compatible server
npm ci
npm run dev
```
`npm run build` writes the static site to `frontend/dist`. The login screen also lets you point the app at a different server.

See [PROJECT_LOG.md](PROJECT_LOG.md) for how it was built.
