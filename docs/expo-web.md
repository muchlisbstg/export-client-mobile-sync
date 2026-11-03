# Expo Web

## Local build

```bash
npm ci
npm run web
npm run export:web
```

The static export is written to `dist/`.

## Runtime configuration

Set `EXPO_PUBLIC_API_URL` to the HTTPS base URL of the deployed API before building a hosted Web release. This variable is public and is embedded in the browser bundle; never put secrets in an `EXPO_PUBLIC_*` variable.

Configure the API's `WEB_ORIGINS` allowlist with the exact Web origin (scheme + host + optional port). The current API default only allows `http://localhost:5173`, so a hosted origin must be explicitly added by the API operator.

Supabase public URL and anon key may be exposed to the browser only when protected by the project's intended Supabase policies and RLS. Never expose service-role keys, database credentials, or peer-sync secrets.

## Sharing behavior

Native builds continue to use React Native `Share.share`. Web uses the Web Share API when available and falls back to the Clipboard API. Browser permissions and secure-context requirements apply.

## Release gate

A successful static export proves bundling only. Before production, validate login, catalog, inquiry creation, tracking, sharing, API CORS, authentication/RLS, and the deployed API URL in a browser. No production deployment is performed by this workflow.
