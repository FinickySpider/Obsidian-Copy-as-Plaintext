import { copyFileSync, mkdirSync } from "fs";

const outdir = "Copy PlainText";

// Ensure output directory exists
mkdirSync(outdir, { recursive: true });

// Copy manifest.json and styles.css
copyFileSync("manifest.json", `${outdir}/manifest.json`);
copyFileSync("styles.css", `${outdir}/styles.css`);
copyFileSync("main.js", `${outdir}/main.js`);

console.log(`✓ Copied manifest.json, main.js,  and styles.css to ${outdir}/`);
