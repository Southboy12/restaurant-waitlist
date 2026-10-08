// Worker entry point for restaurant-waitlist.
//
// - Non-API requests are served from the built frontend via Assets.
// - `/api/*` requests are forwarded to the FastAPI backend running in a
//   Cloudflare Container, fronted by the `Backend` Durable Object below.

import { DurableObject } from 'cloudflare:workers';

interface Env {
  BACKEND: DurableObjectNamespace;
  ASSETS: Fetcher;
  DATABASE_URL: string;
  JWT_SECRET: string;
}

// Ports the backend container may listen on. The Dockerfile runs uvicorn on
// $PORT (default 8000); 8080 is the common containers convention. We probe
// both and use whichever answers the health check first.
const CONTAINER_PORTS = [8000, 8080];
const HEALTH_PATH = '/api/health';
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1000;
const INSTANCE_NAME = 'backend';

type ContainerLike = {
  running: boolean;
  images: { base: unknown };
  start: (options: Record<string, unknown>) => void;
  getTcpPort: (port: number) => Fetcher;
};

function getContainer(ctx: unknown): ContainerLike {
  const container = (ctx as { container?: ContainerLike }).container;
  if (!container) {
    throw new Error('No container is configured for this Durable Object');
  }
  return container;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class Backend extends DurableObject {
  private readyPort: number | null = null;

  private async waitForReady(container: ContainerLike): Promise<number> {
    if (this.readyPort !== null) {
      return this.readyPort;
    }
    if (!container.running) {
      try {
        container.start({ image: container.images.base, enableInternet: true });
      } catch {
        // Another request may have started it concurrently; the poll below confirms.
      }
    }
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastError = 'container did not start';
    while (Date.now() < deadline) {
      for (const port of CONTAINER_PORTS) {
        try {
          const res = await container.getTcpPort(port).fetch(`http://container${HEALTH_PATH}`, {
            signal: AbortSignal.timeout(3000),
          });
          await res.body?.cancel();
          if (res.ok) {
            this.readyPort = port;
            return port;
          }
          lastError = `port ${port}: HTTP ${res.status}`;
        } catch (err) {
          lastError = `port ${port}: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`Backend container did not become ready within ${READY_TIMEOUT_MS}ms (${lastError})`);
  }

  async fetch(request: Request): Promise<Response> {
    const container = getContainer(this.ctx);
    const port = await this.waitForReady(container);
    return container.getTcpPort(port).fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API requests go to the backend container via its Durable Object.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const stub = env.BACKEND.getByName(INSTANCE_NAME);
      return stub.fetch(request);
    }

    // Non-API requests: serve the frontend via Assets.
    return env.ASSETS.fetch(request);
  },
};
