import { serveGitHubAsset } from "../../_asset-helper.js";
export async function onRequest({ request, env, params }) {
  return serveGitHubAsset({
    request, env, folder: "images", filename: params.filename,
    allowedExtensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"]
  });
}
