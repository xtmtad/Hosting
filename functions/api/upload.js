// Cloudflare Pages Function: functions/api/upload.js
// Required Pages environment variables:
// GITHUB_TOKEN (Secret), GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
// Protect /api/upload with Cloudflare Access. Do NOT put GitHub token in HTML.
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_BRANCH) {
      return json({ error: "Server upload configuration is incomplete." }, 500);
    }

    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "");
    const requestedName = String(form.get("filename") || (file && file.name) || "");

    if (!(file instanceof File)) return json({ error: "No file received." }, 400);
    if (!["images", "downloads"].includes(folder)) return json({ error: "Invalid upload folder." }, 400);

    const name = requestedName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name || name.startsWith(".") || name.includes("..")) return json({ error: "Invalid filename." }, 400);

    const ext = name.split(".").pop().toLowerCase();
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const downloadExts = ["plp", "zip"];
    if (folder === "images" && !imageExts.includes(ext)) return json({ error: "Unsupported image type." }, 400);
    if (folder === "downloads" && !downloadExts.includes(ext)) return json({ error: "Only PLP and ZIP files are accepted." }, 400);

    const maxBytes = folder === "images" ? 15 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) return json({ error: `File must be between 1 byte and ${maxBytes / 1024 / 1024} MB.` }, 413);

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
        committer: { name: "PLP Bhandar Upload", email: "upload@plpbhandar.local" }
      })
    });

    const ghData = await gh.json().catch(() => ({}));
    if (!gh.ok) {
      return json({ error: ghData.message || `GitHub API returned ${gh.status}.` }, gh.status);
    }

    const publicUrl = `https://plpbhandar.pages.dev/assets/${folder}/${encodeURIComponent(name)}`;
    return json({ success: true, path, url: publicUrl });
  } catch (err) {
    return json({ error: err?.message || "Unexpected upload error." }, 500);
  }
}
