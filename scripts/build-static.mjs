import { copyFile, mkdir, rm } from "node:fs/promises";

await rm("public", { recursive: true, force: true });
await mkdir("public/src", { recursive: true });

await copyFile("index.html", "public/index.html");
await copyFile("styles.css", "public/styles.css");
await copyFile("src/game.js", "public/src/game.js");
