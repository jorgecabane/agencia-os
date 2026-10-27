import { execFile } from "node:child_process";
import { RUTAS, TEXTOS } from "./claude";

const TIEMPO_MCP_MS = 30_000; // `claude mcp list` revisa cada servidor: puede tardar

/** Salida de `claude mcp list` en el repo (argv fijo, sin shell). */
export function conectores(raiz: string, correr: typeof execFile = execFile): Promise<string> {
  return new Promise((resolver, rechazar) => {
    correr("claude", ["mcp", "list"], {
      cwd: raiz, timeout: TIEMPO_MCP_MS, env: { ...process.env, PATH: [process.env.PATH, ...RUTAS].filter(Boolean).join(":") },
    }, (error, stdout, stderr) => {
      const salida = String(stdout).trim();
      if (!error) return resolver(salida || String(stderr).trim());
      const e = error as NodeJS.ErrnoException & { killed?: boolean };
      if (e.code === "ENOENT") return rechazar(new Error(TEXTOS.instalar));
      if (e.killed) return rechazar(new Error("Revisar los conectores tardó demasiado. Inténtalo de nuevo."));
      rechazar(new Error(salida || String(stderr).trim() || "No pude revisar los conectores."));
    });
  });
}
