import { expect, it } from "vitest";
import { inspiracion, propuestas } from "../ui/datos/propuestas";

it("lee la sección Propuestas y marca la recomendada", () => {
  const cuerpo = [
    "# Post martes", "", "## Brief", "- algo que no es propuesta", "",
    "## Propuestas", "- Carrusel con fotos del casting (recomendada)", "- Reel de 15 s", "* Post único", "",
    "## Notas", "- otra cosa",
  ].join("\n");
  expect(propuestas(cuerpo)).toEqual([
    { texto: "Carrusel con fotos del casting", recomendada: true },
    { texto: "Reel de 15 s", recomendada: false },
    { texto: "Post único", recomendada: false },
  ]);
});

it("sin sección → lista vacía", () => {
  expect(propuestas("# Hola\n\n- algo")).toEqual([]);
});

it("inspiración: imágenes de adjuntos y links citados, sin repetir", () => {
  expect(inspiracion([
    "Carrusel con ![](adjuntos/casting-sep.jpg) y https://drive.google.com/x",
    "Reel como [[clientes/acme/adjuntos/ref.png]] y https://drive.google.com/x",
  ], "acme")).toEqual([
    { tipo: "imagen", ruta: "clientes/acme/adjuntos/casting-sep.jpg" },
    { tipo: "link", url: "https://drive.google.com/x" },
    { tipo: "imagen", ruta: "clientes/acme/adjuntos/ref.png" },
  ]);
});
