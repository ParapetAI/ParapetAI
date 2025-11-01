import { startHttpServer } from "../http/server";
import { handleRequest } from "../http/handlers";
import { log, LogLevel } from "../util/log";

const port = Number(process.env.PORT ?? 3030);

startHttpServer(port, handleRequest)
  .then((running) => {
    log(LogLevel.info, `Runtime listening on http://localhost:${running.port}`);
  })
  .catch((err) => {
    // prettier-ignore
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  });
