// Minimal Durable Object entry point for the backend container.
// This Worker routes requests: serves the frontend via Assets for non-API
// paths, and forwards /api/* to the backend container.

import { DurableObject } from 'cloudflare:workers';

export class Backend extends DurableObject {
  fetch(request: Request): Promise<Response> {
    // Forward to the backend container
    return fetch(request);
  }
}

export default {
  fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // API requests go to the backend container
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      // In a real deployment, this would use env.BACKEND.getByName()
      // to select an instance and forward the request.
      // For now, the worker acts as a reverse proxy.
      return fetch(request);
    }

    // Non-API requests: serve the frontend via Assets
    return env.ASSETS.fetch(request);
  }
};
