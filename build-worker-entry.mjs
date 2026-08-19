import { writeFileSync } from "node:fs";

const entry = `export { default } from "./worker.source.mjs";\nexport * from "./worker.source.mjs";\n`;
writeFileSync(new URL("./worker.js", import.meta.url), entry, "utf8");
console.log("worker.js module entry: ok");
