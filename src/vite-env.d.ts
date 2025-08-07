/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_OPENAI_PROMPT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
