import type http from "node:http";

export function handleRequest(_req: http.IncomingMessage, res: http.ServerResponse): void {
  const body = "Parapet runtime up";
  res.statusCode = 200;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(body, "utf8"));
  res.end(body);
}
