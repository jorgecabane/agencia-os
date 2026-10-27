import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log, show, yo } from "../shell/git";
import { correrSyncSh, crearPausas, crearSync } from "../shell/sync";

describe("crearSync (reloj falso)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function armar(codigos: number[]) {
    const correr = vi.fn(async (_m: string) => codigos.shift() ?? 0);
    const sync = crearSync({ correr, ahora: () => new Date("2026-10-27T14:05:59Z"), persona: () => "jorge" });
    return { correr, sync };
  }

  it("dos escribio() dentro de 5 s hacen una sola ejecución con el mensaje esperado", async () => {
    const { correr, sync } = armar([0]);
    sync.escribio();
    await vi.advanceTimersByTimeAsync(3000);
    sync.escribio();
    await vi.advanceTimersByTimeAsync(4999);
    expect(correr).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(correr).toHaveBeenCalledTimes(1);
    expect(correr).toHaveBeenCalledWith("app: jorge 2026-10-27T14:05Z");
    expect(sync.estado()).toBe("al-dia");
    sync.parar();
  });

  it("código 4: sin-conexion y reintenta en el siguiente ciclo", async () => {
    const { correr, sync } = armar([4, 0]);
    sync.foco();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.estado()).toBe("sin-conexion");
    await vi.advanceTimersByTimeAsync(45_000);
    expect(correr).toHaveBeenCalledTimes(2);
    expect(sync.estado()).toBe("al-dia");
    sync.parar();
  });

  it("código 3: conflicto y no reintenta solo hasta ahora()", async () => {
    const { correr, sync } = armar([3, 0]);
    sync.foco();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.estado()).toBe("conflicto");
    await vi.advanceTimersByTimeAsync(200_000);
    sync.foco();
    expect(correr).toHaveBeenCalledTimes(1);
    await sync.ahora();
    expect(correr).toHaveBeenCalledTimes(2);
    expect(sync.estado()).toBe("al-dia");
    sync.parar();
  });

  it("en pausa no corre y al reanudar corre una vez", async () => {
    const { correr, sync } = armar([0]);
    const reanudar = sync.pausar();
    sync.escribio();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(correr).not.toHaveBeenCalled();
    reanudar();
    reanudar();
    await vi.advanceTimersByTimeAsync(0);
    expect(correr).toHaveBeenCalledTimes(1);
    sync.parar();
  });

  it("enCurso() espera a la ejecución en vuelo y la pausa no deja arrancar otra", async () => {
    let terminar!: (c: number) => void;
    const correr = vi.fn(() => new Promise<number>((r) => (terminar = r)));
    const sync = crearSync({ correr, ahora: () => new Date(), persona: () => "jorge" });
    sync.foco();
    await vi.advanceTimersByTimeAsync(0);
    const reanudar = sync.pausar();
    let listo = false;
    void sync.enCurso().then(() => (listo = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(listo).toBe(false);
    terminar(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(listo).toBe(true);
    expect(correr).toHaveBeenCalledTimes(1);
    reanudar();
    sync.parar();
  });

  it("si persona() falla queda sin-conexion", async () => {
    const sync = crearSync({
      correr: async () => 0,
      ahora: () => new Date(),
      persona: () => {
        throw new Error("x");
      },
    });
    await sync.ahora();
    expect(sync.estado()).toBe("sin-conexion");
    sync.parar();
  });

  it("soltar(dueño) libera las pausas colgadas de un renderer recargado", async () => {
    const { correr, sync } = armar([0]);
    const pausas = crearPausas(sync);
    pausas.pausar(1, 1);
    pausas.pausar(1, 2);
    pausas.pausar(2, 1);
    pausas.reanudar(2, 1);
    sync.foco();
    expect(correr).not.toHaveBeenCalled();
    pausas.soltar(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(correr).toHaveBeenCalledTimes(1);
    sync.parar();
  });

  it("avisa los cambios de estado", async () => {
    const { sync } = armar([0]);
    const vistos: string[] = [];
    sync.onEstado((e) => vistos.push(e));
    await sync.ahora();
    expect(vistos).toEqual(["subiendo", "al-dia"]);
    sync.parar();
  });
});

describe("integración con sync.sh real", () => {
  const ENV = {
    ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
    GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
  };
  const git = (cwd: string, ...a: string[]) =>
    execFileSync("git", ["-C", cwd, "-c", "commit.gpgsign=false", ...a], { env: ENV, encoding: "utf8", stdio: "pipe" });

  const envPrevio = { ...process.env };
  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in envPrevio)) delete process.env[k];
    Object.assign(process.env, envPrevio);
  });

  it("rechaza desde y max peligrosos", async () => {
    await expect(log("/x", { desde: "--output=/tmp/x" })).rejects.toThrow("desde");
    await expect(log("/x", { desde: "a b" })).rejects.toThrow("desde");
    await expect(log("/x", { max: -1 })).rejects.toThrow("max");
    await expect(log("/x", { max: 1.5 })).rejects.toThrow("max");
  });

  it("sube un cambio y git.log/show/yo lo ven", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "aos-sync-"));
    const remoto = join(tmp, "r.git");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", remoto], { env: ENV });
    const a = join(tmp, "a");
    git(tmp, "clone", "-q", remoto, a);
    git(a, "checkout", "-q", "-b", "main");
    git(a, "config", "user.name", "Ana");
    git(a, "config", "user.email", "ana@x.cl");
    writeFileSync(join(a, "f.txt"), "1\n");
    git(a, "add", "-A");
    git(a, "commit", "-qm", "init");
    git(a, "push", "-q", "-u", "origin", "main");
    // sync.sh vive en el repo real; la copia temporal lo usa vía ruta absoluta
    const sh = resolve(__dirname, "../../.claude/hooks/sync.sh");
    execFileSync("mkdir", ["-p", join(a, ".claude/hooks")]);
    execFileSync("cp", [sh, join(a, ".claude/hooks/sync.sh")]);
    git(a, "add", "-A");
    git(a, "commit", "-qm", "hook");
    writeFileSync(join(a, "f.txt"), "1\n2\n");

    Object.assign(process.env, ENV);
    const codigo = await correrSyncSh(a)("app: jorge 2026-10-27T14:05Z");
    expect(codigo).toBe(0);
    expect(git(remoto, "log", "-1", "--format=%s").trim()).toBe("app: jorge 2026-10-27T14:05Z");

    const [ultimo] = await log(a, { max: 1 });
    expect(ultimo).toMatchObject({ autor: "t", email: "t@t", rutas: ["f.txt"] });
    expect(await show(a, ultimo.hash, "f.txt")).toBe("1\n2\n");
    expect((await log(a, { ruta: "f.txt" })).length).toBe(2);
    expect(await yo(a)).toEqual({ nombre: "Ana", email: "ana@x.cl" });
  });
});
