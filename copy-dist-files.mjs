import { copyFileSync, mkdirSync } from "fs";

const outdir = "Copy PlainText";

// Ensure output directory exists
mkdirSync(outdir, { recursive: true });

// Copy manifest.json and styles.css (main.js is already built into outdir by esbuild)
copyFileSync("manifest.json", `${outdir}/manifest.json`);
copyFileSync("styles.css", `${outdir}/styles.css`);

console.log(`✓ Copied manifest.json and styles.css to ${outdir}/`);
