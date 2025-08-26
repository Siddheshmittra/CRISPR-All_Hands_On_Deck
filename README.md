## Natural language mode

- Local dev: add your OpenAI key to `.env.development.local` as `VITE_OPENAI_API_KEY` and restart dev server.
- GitHub Pages: browser cannot hold secrets. Deploy a proxy and set `VITE_LLM_PROXY_URL` to your proxy origin.

### Quick proxy (Vercel)
1. Import this repo into Vercel.
2. Add an environment variable `OAI_API_KEY` in the Vercel project settings.
3. Deploy. Your endpoints will be:
   - `<vercel-url>/api/llmProxy/parse`
   - `<vercel-url>/api/llmProxy/plan`
4. In this repo, set `VITE_LLM_PROXY_URL=<vercel-url>/api/llmProxy` in `.env.local` (not committed). Rebuild Pages.

