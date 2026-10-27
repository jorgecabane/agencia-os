import { describe, expect, it } from "vitest";
import { hayEditorSinGuardar, registrarEditor, sePuedeRecargar } from "../ui/datos/recarga";

describe("recargar la UI nueva", () => {
  it("espera a los editores sin guardar, también a uno cerrado que sigue guardando", () => {
    const a = { sucio: true, montado: true };
    registrarEditor({ sinGuardar: () => a.sucio, montado: () => a.montado });
    expect(sePuedeRecargar()).toBe(false);
    a.montado = false; // salió del editor con un guardado pendiente
    expect(hayEditorSinGuardar()).toBe(true);
    a.sucio = false;
    expect(sePuedeRecargar()).toBe(true);
    a.sucio = true; // ya se olvidó: un editor cerrado y guardado no vuelve
    expect(hayEditorSinGuardar()).toBe(false);
  });
});
