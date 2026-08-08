# Anthropic proxy (optional)

This is **not required** to use Anthropic in the app — the adapter
(`src/providers/anthropic.ts`) talks directly to `api.anthropic.com` by
default, using Anthropic's documented `anthropic-dangerous-direct-browser-access`
header to work around the lack of CORS support for direct browser calls.

Deploy this only if you want to:

- **Hide your API key** from the browser entirely (set `ANTHROPIC_API_KEY`
  as a server secret on whichever platform you deploy to — the proxy then
  ignores whatever key the client sends and always uses the server one)
- Avoid the direct-browser-access header/behavior for any other reason

It is completely stateless: no logging, no storage, nothing persists
between requests. `handler.ts` contains the actual logic; the two other
files are thin per-platform entrypoints around it.

## Deploy to Cloudflare Workers

```bash
npm install -g wrangler
wrangler deploy functions/anthropic-proxy/cloudflare-worker.ts --name power-ai-chatbot-anthropic-proxy \
  --compatibility-date 2024-01-01
# Optional — hides the key entirely:
wrangler secret put ANTHROPIC_API_KEY
```

## Deploy to Vercel (Edge Function)

Copy `vercel-edge.ts` (and `handler.ts`) into an `api/` directory in a
Vercel project as `api/anthropic-proxy.ts`, then:

```bash
vercel env add ANTHROPIC_API_KEY   # optional — hides the key entirely
vercel deploy
```

## Point the app at it

Once deployed, open **Settings → Anthropic** in the app and paste the
deployed URL into **Proxy URL** (e.g. `https://your-worker.workers.dev` or
`https://your-app.vercel.app/api/anthropic-proxy`). The adapter will send
`/messages` and `/models` requests to `<proxy URL>/messages` and
`<proxy URL>/models` instead of Anthropic directly, and stop sending the
direct-browser-access header (the proxy sets its own CORS headers instead).

Leave Proxy URL blank to keep calling Anthropic directly — both modes are
fully supported.
