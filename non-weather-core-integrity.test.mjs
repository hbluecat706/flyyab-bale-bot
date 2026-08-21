import assert from "node:assert/strict";
import fs from "node:fs";import crypto from "node:crypto";
const expected=JSON.parse(fs.readFileSync(new URL("./V1.7-NON-WEATHER-HASHES.json",import.meta.url),"utf8"));
for(const [file,hash] of Object.entries(expected)){const b=fs.readFileSync(new URL("./"+file,import.meta.url));const h=crypto.createHash("sha256").update(b).digest("hex");assert.equal(h,hash,`${file} changed unexpectedly`)}
console.log("non-weather-core-integrity: PASS");
