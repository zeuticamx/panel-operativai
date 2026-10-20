/**
 * Enlaces capturados por el usuario: solo se pintan como <a href> si son https.
 */
import { urlSegura } from "@/lib/url-segura";

describe("urlSegura", () => {
  it("acepta https", () => {
    const url = "https://docs.google.com/spreadsheets/d/abc123";
    expect(urlSegura(url)).toBe(url);
  });

  it("rechaza esquemas peligrosos", () => {
    expect(urlSegura("javascript:alert(1)")).toBeNull();
    expect(urlSegura("JaVaScRiPt:alert(1)")).toBeNull();
    expect(urlSegura("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rechaza http plano, texto suelto y vacíos", () => {
    expect(urlSegura("http://example.com")).toBeNull();
    expect(urlSegura("no es una url")).toBeNull();
    expect(urlSegura("")).toBeNull();
    expect(urlSegura(null)).toBeNull();
    expect(urlSegura(undefined)).toBeNull();
  });
});
