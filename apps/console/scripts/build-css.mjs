import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
process.chdir(projectRoot);
const inputPath = resolve("src/index.css");
const outputPath = resolve("../console-dist/app.css");

const css = await readFile(inputPath, "utf8");
const result = await postcss([
  tailwindcss({ config: resolve("tailwind.config.js") }),
  autoprefixer(),
]).process(css, { from: inputPath, to: outputPath, map: false });

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, result.css, "utf8");


