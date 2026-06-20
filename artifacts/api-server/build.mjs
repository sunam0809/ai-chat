import * as esbuild from "esbuild";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pinoPlugin;
try {
  const { pino } = await import("esbuild-plugin-pino");
  pinoPlugin = pino({ transports: ["pino-pretty"] });
} catch {
  pinoPlugin = null;
}

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.mjs",
  plugins: pinoPlugin ? [pinoPlugin] : [],
  external: ["pg-native"],
  banner: {
    js: `
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
`.trim(),
  },
});

console.log("Build complete: dist/index.mjs");

