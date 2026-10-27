// Prueba de humo: arranca Electron con el shell compilado sobre una copia de tests/fixtures/repo.
// Sale 0 si la ventana principal cargó y pintó la app; 1 si no (el shell se rinde a los 20 s).
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "aos-humo-"));
const repo = join(tmp, "repo");
const datos = join(tmp, "datos");
cpSync(join(app, "tests/fixtures/repo"), repo, { recursive: true });
mkdirSync(join(repo, ".claude"));
writeFileSync(join(repo, ".claude/settings.local.json"), JSON.stringify({ env: { AOS_PERSONA: "cami" } }));
const git = (...a) => execFileSync("git", ["-c", "user.name=Humo", "-c", "user.email=humo@example.com", ...a], { cwd: repo, stdio: "ignore" });
git("init", "-q");
git("add", "-A");
git("commit", "-qm", "humo");
mkdirSync(datos);
writeFileSync(join(datos, "config.json"), JSON.stringify({ repo }));

const hijo = spawn(electron, [app], { env: { ...process.env, AOS_SMOKE: "1", AOS_DATOS: datos }, stdio: "inherit" });
let matado = false; // un Electron matado sale con 0: eso no es un éxito
const reserva = setTimeout(() => { matado = true; hijo.kill(); }, 30_000); // por si el shell ni siquiera alcanza a rendirse
hijo.on("exit", (salida) => {
  clearTimeout(reserva);
  const codigo = matado ? "sin respuesta" : salida;
  rmSync(tmp, { recursive: true, force: true });
  console.log(codigo === 0 ? "humo: ok, la app abrió y pintó" : `humo: falló (salida ${codigo})`);
  process.exit(codigo === 0 ? 0 : 1);
});
