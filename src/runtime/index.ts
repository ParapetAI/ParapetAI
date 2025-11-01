import { startHttpServer } from "@parapetai/parapet/runtime/http/server";
import { log, LogLevel } from "@parapetai/parapet/runtime/util/log";
import { bootstrapRuntime } from "@parapetai/parapet/runtime/core/bootstrap";

const port: number = Number(process.env.PORT ?? 8000);

bootstrapRuntime()
  .then(() => startHttpServer(port))
  .then(({ port: bound }) => {
    log(LogLevel.info, `Runtime listening on http://0.0.0.0:${bound}`);
  })
  .catch((err) => {
    // prettier-ignore
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  });
