export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const body = `User-agent: *
Allow: /
Sitemap: ${new URL("/sitemap.xml", origin)}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
