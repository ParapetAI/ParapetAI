import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 3000);
const SECRET = process.env.WEBHOOK_SECRET ?? "test-secret";

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(body);
      const signature = req.headers["x-parapet-signature"] as string;

      if (signature) {
        const expectedSig = crypto
          .createHmac("sha256", SECRET)
          .update(body)
          .digest("hex");
        const receivedSig = signature.replace("sha256=", "");

        if (receivedSig !== expectedSig) {
          console.error("[SECURITY] Invalid signature!");
          console.error(`Expected: sha256=${expectedSig}`);
          console.error(`Received: ${signature}`);
        } else {
          console.log("[SECURITY] Signature verified ✓");
        }
      } else {
        console.warn("[WARNING] No signature header received");
      }

      console.log("\n" + "=".repeat(80));
      console.log(`[${new Date().toISOString()}] Webhook Event Received`);
      console.log("=".repeat(80));
      console.log(JSON.stringify(payload, null, 2));
      console.log("=".repeat(80) + "\n");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("Error processing webhook:", err);
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad request");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Webhook receiver listening on http://localhost:${PORT}`);
  console.log(`Webhook secret: ${SECRET}`);
  console.log(`\nConfigure your route webhook URL to: http://localhost:${PORT}/webhook`);
  console.log(`Set WEBHOOK_SECRET env var to match your webhook secret\n`);
});

