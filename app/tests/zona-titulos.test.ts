import { afterEach, describe, expect, it } from "vitest";
import { diaDe, fechaLocal, fijarZona, horaDe, titulo } from "../ui/datos/hoy";
import { actualizarIndice, construirIndice } from "../ui/datos/indice";
import { resumen } from "../ui/datos/resumen";

afterEach(() => fijarZona(undefined));

describe("horas en la zona de quien mira", () => {
  it("una reunión guardada en UTC se ve a la hora local", () => {
    fijarZona("America/Santiago");
    expect(horaDe("2026-10-27T13:00Z")).toBe("10:00");
    fijarZona("Europe/Madrid");
    expect(horaDe("2026-10-27T13:00Z")).toBe("14:00");
  });
  it("respeta el offset escrito en la fecha", () => {
    fijarZona("America/Santiago");
    expect(horaDe("2026-01-20T10:00-03:00")).toBe("10:00");
  });
  it("el día cambia si en tu zona aún es ayer", () => {
    fijarZona("America/Santiago");
    expect(diaDe("2026-10-28T01:30Z")).toBe("2026-10-27");
    expect(fechaLocal(new Date("2026-10-28T01:30Z"))).toBe("2026-10-27");
  });
  it("sin hora no hay hora, y la fecha queda igual", () => {
    expect(horaDe("2026-10-27")).toBe("");
    expect(diaDe("2026-10-27")).toBe("2026-10-27");
  });
  it("una zona inválida cae a la del Mac sin romper", () => {
    fijarZona("Marte/Olympus");
    expect(horaDe("2026-10-27T13:00Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("títulos legibles", () => {
  const ruta = "clientes/acme/entregables/2026-10-29-cotizacion-navidad.md";
  const ent = (extra: string, cuerpo = "") =>
    `---\ntipo: entregable\ncliente: acme\nformato: doc\nvence: 2026-10-29\nestado: brief\nresponsable: cami\n${extra}---\n${cuerpo}`;
  it("usa titulo del frontmatter, luego el # del cuerpo, luego el nombre del archivo", () => {
    const i = construirIndice(new Map([[ruta, ent("titulo: Cotización de Navidad\n")]]));
    expect(titulo(ruta)).toBe("Cotización de Navidad");
    actualizarIndice(i, new Map([[ruta, ent("", "# Cotización Navidad 2026\n")]]));
    expect(titulo(ruta)).toBe("Cotización Navidad 2026");
    actualizarIndice(i, new Map([[ruta, null]]));
    expect(titulo(ruta)).toBe("Cotizacion navidad");
  });
  it("un correo para aprobar se titula con su asunto", () => {
    const r = "bandeja/2026-10-27-aprobacion-dm-donnas.md";
    construirIndice(new Map([[r, "---\ntipo: aprobacion\npersona: jorge\ncliente: acme\ncanal: email\nestado: pendiente\nasunto: Cotización de Navidad\n---\nHola"]]));
    expect(titulo(r)).toBe("Cotización de Navidad");
  });
});

it("la línea de tiempo no muestra el guion de la viñeta", () => {
  const r = resumen(construirIndice(new Map()), "acme", "2026-10-27", { linea: "# Línea\n\n- 2026-10-20 · Revisión mensual" });
  expect(r.linea).toEqual(["2026-10-20 · Revisión mensual"]);
});
