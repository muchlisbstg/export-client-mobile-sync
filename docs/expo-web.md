# Expo Web

## Local build

```bash
npm ci
npm run web
npm run export:web
```

The single-page application export is written to `dist/`. The project does not use Expo Router, so `web.output` is set to `single` rather than route-prerendered `static` output.

## Runtime configuration

Set `EXPO_PUBLIC_API_URL` to the HTTPS base URL of the deployed API before building a hosted Web release. This variable is public and is embedded in the browser bundle; never put secrets in an `EXPO_PUBLIC_*` variable.

Configure the API's `WEB_ORIGINS` allowlist with the exact Web origin (scheme + host + optional port). The current API default only allows `http://localhost:5173`, so a hosted origin must be explicitly added by the API operator.

Supabase public URL and anon key may be exposed to the browser only when protected by the project's intended Supabase policies and RLS. Never expose service-role keys, database credentials, or peer-sync secrets.

## Sharing behavior

Native builds continue to use React Native `Share.share`. Web uses the Web Share API when available and falls back to the Clipboard API. Browser permissions and secure-context requirements apply.

## Hosting note

Because this is a single-page application, configure the static host to rewrite application routes to `index.html` if client-side routes are added later.

## Release gate

A successful static export proves bundling only. Before production, validate login, catalog, inquiry creation, tracking, sharing, API CORS, authentication/RLS, and the deployed API URL in a browser. No production deployment is performed by this workflow.
