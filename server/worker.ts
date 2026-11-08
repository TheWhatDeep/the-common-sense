/**
 * Cloudflare Workers entry point. /api/* goes to the API; everything else is
 * served from the built app in dist/ (the ASSETS binding).
 */
import { handle } from './api';
import type { Env } from './http';

type WorkerEnv = Env & { ASSETS: Fetcher };

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/'))
      return handle(request, env, { waitUntil: (p) => ctx.waitUntil(p) });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
