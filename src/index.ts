import { createHttpApp } from './http/app.ts';

// Worker entry. The Hono app handles requests (http → app → data via the context
// middleware). One Worker, two roles by route: the public collector on tracked
// zones, and the dashboard/API on the app domain (gated by Cloudflare Access).
const app = createHttpApp();

export default {
  fetch: app.fetch.bind(app),
  request: app.request.bind(app),
};
