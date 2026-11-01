// Shared helper for GitHub-backed Pages CDN routes.
export async function serveGitHubAsset({ request, env, folder, filename, allowedExtensions }) {
  const name = decodeURIComponent(filename || "");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return new Response("Not found", { status: 404 });
  }
  const ext = name.split(".").pop().toLowerCase();
  if (!allowedExtensions.includes(ext)) return new Response("Unsupported file type", { status: 404 });

  const owner = env.GITHUB_OWNER || "xtmtad";
  const repo = env.GITHUB_REPO || "Hosting";
  const branch = env.GITHUB_BRANCH || "main";
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${folder}/${encodeURIComponent(name)}`;

  const headers = new Headers();
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);

  const upstream = await fetch(rawUrl, { headers });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(upstream.status === 404 ? "Not found" : "Upstream error", {
      status: upstream.status === 404 ? 404 : 502
    });
  }

  const outHeaders = new Headers();
  const type = folder === "images"
    ? (ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg")
    : "application/octet-stream";
  outHeaders.set("Content-Type", type);
  outHeaders.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  outHeaders.set("X-Content-Type-Options", "nosniff");
  if (folder === "downloads") {
    outHeaders.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  for (const key of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
    const value = upstream.headers.get(key);
    if (value) outHeaders.set(key, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}
