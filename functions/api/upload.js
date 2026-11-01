
// Cloudflare Pages Function: functions/api/upload.js
const ALLOWED_ORIGIN = "https://www.plpbhandar.my.id";

function corsHeaders(origin) {
  const headers = new Headers();
  if (origin === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function json(data, status = 200, origin = "") {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin") || "";
  if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403, origin);

  try {
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_BRANCH) {
      return json({ error: "Server upload configuration is incomplete." }, 500, origin);
    }

    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "");
    const requestedName = String(form.get("filename") || (file && file.name) || "");

    if (!(file instanceof File)) return json({ error: "No file received." }, 400, origin);
    if (!["images", "downloads"].includes(folder)) return json({ error: "Invalid upload folder." }, 400, origin);

    const name = requestedName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name || name.startsWith(".") || name.includes("..")) return json({ error: "Invalid filename." }, 400, origin);

    const ext = name.split(".").pop().toLowerCase();
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const downloadExts = ["plp", "zip"];

    if (folder === "images" && !imageExts.includes(ext)) return json({ error: "Unsupported image type." }, 400, origin);
    if (folder === "downloads" && !downloadExts.includes(ext)) return json({ error: "Only PLP and ZIP files are accepted." }, 400, origin);

    const maxBytes = folder === "images" ? 15 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      return json({ error: `File must be between 1 byte and ${maxBytes / 1024 / 1024} MB.` }, 413, origin);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const content = btoa(binary);
    const path = `${folder}/${name}`;
    const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;

    const gh = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Upload ${name} to ${folder}`,
        content,
        branch: env.GITHUB_BRANCH,
        committer: {
          name: "PLP Bhandar Upload",
          email: "upload@plpbhandar.local"
        }
      })
    });

    const ghData = await gh.json().catch(() => ({}));
    if (!gh.ok) return json({ error: ghData.message || `GitHub API returned ${gh.status}.` }, gh.status, origin);

    const publicUrl = `https://plpbhandar.pages.dev/assets/${folder}/${encodeURIComponent(name)}`;
    return json({ success: true, path, url: publicUrl }, 200, origin);
  } catch (err) {
    return json({ error: err?.message || "Unexpected upload error." }, 500, origin);
  }
}
