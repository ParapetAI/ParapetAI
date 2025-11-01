import http from "node:http";

export type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export interface RunningServer {
  readonly server: http.Server;
  readonly port: number;
  close(): Promise<void>;
}

export async function startHttpServer(port: number, handler: RequestHandler): Promise<RunningServer> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  return {
    server,
    port: (server.address() && typeof server.address() === "object" ? (server.address() as any).port : port) as number,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
