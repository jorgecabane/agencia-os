import { beforeAll, describe, expect, it } from "vitest";
import { leerConversaciones, enviar } from "../ui/datos/chat";
import { contextoDe } from "../ui/datos/contexto-chat";

const nombre = (slug: string) => (slug === "donnas" ? "Donna's" : slug);

describe("contextoDe", () => {
  it("hoy → Mi día, global", () => {
    expect(contextoDe({ nombre: "hoy" }, nombre)).toMatchObject({ contextoId: "global", etiqueta: "Mi día" });
  });
  it("tablero → Todo el espacio, global", () => {
    expect(contextoDe({ nombre: "tablero" }, nombre)).toMatchObject({ contextoId: "global", etiqueta: "Todo el espacio" });
  });
  it("cliente → clientes/<slug> con su nombre", () => {
    expect(contextoDe({ nombre: "cliente", slug: "donnas" }, nombre))
      .toEqual({ contextoId: "clientes/donnas", contexto: "clientes/donnas", etiqueta: "Donna's" });
  });
  it("editar → la ruta con su título", () => {
    const ruta = "clientes/donnas/entregables/2026-10-30-post-jueves.md";
    expect(contextoDe({ nombre: "editar", ruta, desde: { nombre: "hoy" } }, nombre))
      .toEqual({ contextoId: ruta, contexto: ruta, etiqueta: "Post jueves" });
  });
});

describe("conversaciones de la sesión", () => {
  beforeAll(() => {
    (globalThis as { window?: unknown }).window = {
      aos: { claude: { onEvento: () => () => {}, enviar: () => new Promise(() => {}), cancelar: () => {} } },
    };
  });
  it("la más reciente primero, con el último mensaje del usuario", () => {
    enviar("global", "hola", "Mi día", "Mi día");
    enviar("clientes/donnas", "¿cómo vamos?", "clientes/donnas", "Donna's");
    enviar("global", "¿qué vence?", "Todo el espacio", "Todo el espacio");
    expect(leerConversaciones().map(({ id, etiqueta, ultimo }) => ({ id, etiqueta, ultimo }))).toEqual([
      { id: "global", etiqueta: "Todo el espacio", ultimo: "¿qué vence?" },
      { id: "clientes/donnas", etiqueta: "Donna's", ultimo: "¿cómo vamos?" },
    ]);
  });
});
