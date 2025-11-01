import readline from "node:readline";
import { Writable } from "node:stream";

class MuteStream extends Writable {
  _write(_chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    callback();
  }
}

export async function promptForSecret(label: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // prettier-ignore
    console.error(`Prompting for ${label} (stdin not TTY, input will be echoed)`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise<string>((resolve) => rl.question(`${label}: `, (ans) => { rl.close(); resolve(ans); }));
  }

  const muted = new MuteStream();
  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  // prettier-ignore
  process.stdout.write(`${label}: `);
  return await new Promise<string>((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

