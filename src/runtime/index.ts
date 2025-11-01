import { startHttpServer } from "@parapetai/parapet/runtime/http/server";
import { handleRequest } from "@parapetai/parapet/runtime/http/handlers";
import { log, LogLevel } from "@parapetai/parapet/runtime/util/log";

const port: number = Number(process.env.PORT ?? 8000);

startHttpServer(port, handleRequest)
  .then(({ port: bound }) => {
    log(LogLevel.info, `Runtime listening on http://0.0.0.0:${bound}`);
  })
  .catch((err) => {
    // prettier-ignore
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  });


