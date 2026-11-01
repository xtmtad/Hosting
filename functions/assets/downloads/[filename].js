import { serveGitHubAsset } from "../../_asset-helper.js";
export async function onRequest({ request, env, params }) {
  return serveGitHubAsset({
    request, env, folder: "downloads", filename: params.filename,
    allowedExtensions: ["plp", "zip"]
  });
}
