import type http from "node:http";
import { handleHealthRequest } from "@parapetai/parapet/runtime/http/health/index";

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method === "GET" && req.url === "/health") {
    handleHealthRequest(req, res);
    return;
  }

  // 404
  res.statusCode = 404;
  res.end();
}
