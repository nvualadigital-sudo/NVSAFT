/** Origin only: prevents credentials, redirects injected via paths and insecure mixed content. */
export function httpsOrigin(value, variable = "NV_NETLIFY_API_ORIGIN") {
  const raw = String(value || "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {}
  if (
    !url ||
    !/^https:\/\/[^\s/?#]+\/?$/i.test(raw) ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `Configure ${variable} com a origem HTTPS da API (ex.: https://api.exemplo.ao), sem /api, caminho, parâmetros ou credenciais.`,
    );
  }
  return url.origin;
}
export function resolveNetlifyConfig(env) {
  const api = httpsOrigin(
    env.NV_NETLIFY_API_ORIGIN?.trim() || env.VITE_API_URL?.trim(),
  );
  for (const site of [env.URL, env.DEPLOY_PRIME_URL, env.DEPLOY_URL]) {
    if (site && new URL(site).origin === api)
      throw new Error(
        "A API deve apontar para o servidor Node, e não para o próprio site Netlify.",
      );
  }
  return { api, direct: env.NV_NETLIFY_STAFF_DIRECT === "1" };
}
export function redirectsFor(api) {
  // A primeira regra aplicável vence; encaminhar a API antes de tentar servir HTML.
  return `/api ${api}/api 200!\n/api/* ${api}/api/:splat 200!\n/* /index.html 200\n`;
}
