module.exports = function handler(_request, response) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const siteUrl = getSiteUrl();
  const blockedSecret = isSecretSupabaseKey(supabaseAnonKey);

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    supabaseUrl: blockedSecret ? "" : supabaseUrl,
    supabaseAnonKey: blockedSecret ? "" : supabaseAnonKey,
    siteUrl,
    warning: blockedSecret ? "Supabase secret/service_role key must not be exposed to the browser." : ""
  });
};

function getSiteUrl() {
  if (process.env.SITE_URL) return normalizeUrl(process.env.SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) return normalizeUrl(`https://${process.env.VERCEL_URL}`);
  return "";
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, "");
}

function isSecretSupabaseKey(key) {
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;

  const parts = key.split(".");
  if (parts.length < 2) return false;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}
