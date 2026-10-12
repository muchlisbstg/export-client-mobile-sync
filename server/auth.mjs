export function createSupabaseAuth(options = {}) {
  const url = String(options.url ?? process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = String(options.anonKey ?? process.env.SUPABASE_ANON_KEY ?? "").trim();
  const source = options.adminUserIds ?? String(process.env.ADMIN_USER_IDS ?? "").split(",");
  const admins = new Set(source.map((value) => String(value).trim()).filter(Boolean));
  const fetcher = options.fetcher ?? fetch;

  async function authenticate(req, res, next) {
    if (!url || !anonKey) return res.status(503).json({ error: "auth_not_configured" });
    const match = /^Bearer\s+([^\s]+)$/i.exec(req.get("authorization") ?? "");
    if (!match) return res.status(401).json({ error: "authentication_required" });
    try {
      const result = await fetcher(`${url}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!result.ok) return res.status(401).json({ error: "invalid_or_expired_token" });
      const user = await result.json();
      if (typeof user?.id !== "string" || !user.id.trim()) return res.status(401).json({ error: "invalid_identity" });
      res.locals.authIdentity = { id: user.id, role: admins.has(user.id) ? "admin" : "customer" };
      return next();
    } catch {
      return res.status(503).json({ error: "identity_provider_unavailable" });
    }
  }

  function requireAdmin(_req, res, next) {
    const identity = res.locals.authIdentity;
    if (!identity) return res.status(401).json({ error: "authentication_required" });
    if (identity.role !== "admin") return res.status(403).json({ error: "admin_required" });
    return next();
  }

  return { authenticate, requireAdmin };
}
