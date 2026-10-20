import {
  aSlug,
  cantidadDeVariables,
  rellenar,
  variablesConsecutivas,
  variablesDe,
} from "../plantillas";

describe("plantillas", () => {
  it("saca las variables en orden y sin repetir", () => {
    expect(variablesDe("{{2}} y {{1}} y {{2}}")).toEqual([2, 1]);
    expect(cantidadDeVariables("Hola {{1}}, {{3}}")).toBe(3);
    expect(cantidadDeVariables("sin variables")).toBe(0);
  });

  it("detecta saltos en las variables", () => {
    expect(variablesConsecutivas("{{1}} {{2}}")).toBe(true);
    expect(variablesConsecutivas("{{1}} {{3}}")).toBe(false);
  });

  it("rellena y deja la marca mientras falte el valor", () => {
    expect(rellenar("Hola {{1}}, es el {{2}}", ["Ana", ""])).toBe("Hola Ana, es el {{2}}");
  });

  it("convierte un nombre en slug válido para Meta", () => {
    expect(aSlug("Promoción de Verano!")).toBe("promocion_de_verano");
    expect(aSlug("  __Hola  Mundo__ ")).toBe("hola_mundo");
  });
});
