/// <reference types="vite/client" />

// Vinext supplies the concrete Cloudflare bindings during the worker build.
// These declarations let the shared TypeScript check understand that boundary.
declare type Fetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

declare type D1Database = unknown;

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
