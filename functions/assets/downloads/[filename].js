
export async function onRequest({ request, params }) {
  const filename = params.filename;

  if (
    typeof filename !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/i.test(filename) ||
    filename.includes("..")
  ) {
    return new Response("Invalid filename", { status: 400 });
  }

  const url =
    `https://raw.githubusercontent.com/xtmtad/Hosting/main/downloads/${encodeURIComponent(filename)}`;

  const headers = new Headers();
  const range = request.headers.get("Range");

  if (range) headers.set("Range", range);

  const res = await fetch(url, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers
  });

  if (!res.ok && res.status !== 206) {
    return new Response("File not found", {
      status: res.status === 404 ? 404 : 502
    });
  }

  const outputHeaders = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "public, max-age=3600"
  });

  return new Response(
    request.method === "HEAD" ? null : res.body,
    { status: res.status, headers: outputHeaders }
  );
}
