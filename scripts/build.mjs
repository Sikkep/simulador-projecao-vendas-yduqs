import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const routes = ["projecao", "resultados", "oportunidades", "anotacoes"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "index.html"), resolve(output, "index.html"));
await cp(resolve(root, "favicon.svg"), resolve(output, "favicon.svg"));
await cp(resolve(root, "src"), resolve(output, "src"), { recursive: true });

for (const route of routes) {
  const directory = resolve(output, route);
  await mkdir(directory, { recursive: true });
  await cp(resolve(root, "index.html"), resolve(directory, "index.html"));
}

console.log(`Build local concluído: ${routes.length} rotas em dist/.`);
