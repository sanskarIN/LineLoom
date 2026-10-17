export function validateEndpoint(endpoint: string): { origin: string; remote: boolean } {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error("Invalid Ollama endpoint URL."); }
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  const local = localHosts.includes(url.hostname.toLowerCase());
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("Ollama endpoint must be a plain origin without credentials, paths or query parameters.");
  if (local && !["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported endpoint protocol.");
  if (!local && url.protocol !== "https:") throw new Error("Remote endpoints must use HTTPS.");
  return { origin: url.origin, remote: !local };
}
