/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OAI_API_KEY?: string;
  readonly VITE_OPENAI_PROMPT_ID?: string;
  readonly VITE_LLM_PROXY_URL?: string; // e.g., https://your-vercel-app.vercel.app/api
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
