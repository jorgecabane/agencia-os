import { expect, it } from "vitest";
import { promesasDeActa } from "../ui/datos/promesas";
import type { Reunion } from "../ui/datos/tipos";

const acta: Reunion = { ruta: "clientes/acme/reuniones/2026-10-01-kickoff.md", tipo: "reunion", cliente: "acme", fecha: "2026-10-01" };
const cuerpo = `# Acta
- [ ] fuera: no cuenta (2026-10-01)
## Promesas
- [ ] jorge: enviar propuesta (2026-10-30)
- [x] ana: mandar logos (sin fecha)
texto suelto
## Otro
- [ ] jorge: tampoco (2026-11-01)
`;

it("separa equipo de cliente y lee sin fecha como null", () => {
  expect(promesasDeActa(acta, cuerpo, new Set(["jorge"])).promesas).toEqual([
    { quien: "jorge", que: "enviar propuesta", fecha: "2026-10-30", hecha: false, delCliente: false, acta: acta.ruta },
    { quien: "ana", que: "mandar logos", fecha: null, hecha: true, delCliente: true, acta: acta.ruta },
  ]);
});

it("acepta viñetas *, sangría, fecha ausente o ilegible, y equipo sin distinguir mayúsculas", () => {
  const c = "## Promesas\n* [ ] Jorge: llamar\n  - [x] ana: mandar (30/10)\n- [ ] sin dos puntos\n";
  const r = promesasDeActa(acta, c, new Set(["jorge"]));
  expect(r.promesas).toEqual([
    expect.objectContaining({ quien: "Jorge", que: "llamar", fecha: null, delCliente: false }),
    expect.objectContaining({ quien: "ana", que: "mandar (30/10)", fecha: null, hecha: true, delCliente: true }),
  ]);
  expect(r.ignoradas).toEqual(["- [ ] sin dos puntos"]);
});
