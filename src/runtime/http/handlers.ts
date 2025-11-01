import type http from "node:http";

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method === "GET" && req.url === "/health") {
    const body = "Parapet runtime up";
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("content-length", Buffer.byteLength(body, "utf8"));
    res.end(body);
    return;
  }

  res.statusCode = 404;
  res.end();
}
