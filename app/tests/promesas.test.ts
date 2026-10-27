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
  expect(promesasDeActa(acta, cuerpo, new Set(["jorge"]))).toEqual([
    { quien: "jorge", que: "enviar propuesta", fecha: "2026-10-30", hecha: false, delCliente: false, acta: acta.ruta },
    { quien: "ana", que: "mandar logos", fecha: null, hecha: true, delCliente: true, acta: acta.ruta },
  ]);
});
