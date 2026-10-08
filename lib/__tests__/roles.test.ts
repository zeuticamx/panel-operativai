/**
 * Qué pantallas ve cada rol (lib/roles.ts). Espejo de las guardas del
 * backend: si esto deja pasar algo que el backend niega, el usuario ve una
 * pantalla llena de 403.
 */
import { inicioDeRol, puedeVerRuta } from "@/lib/roles";
import type { UsuarioOut } from "@/lib/types";

function con(role: string): UsuarioOut {
  return {
    id: "u",
    email: "x@y.com",
    full_name: null,
    role,
    tenant_id: "t",
    nombre_negocio: "Negocio",
    es_gerencia_plataforma: false,
  };
}

test.each(["/dashboard", "/conversaciones/c-1", "/agente", "/suscripcion", "/vendedores/equipo", "/preferencias"])(
  "el dueño ve %s",
  (ruta) => {
    expect(puedeVerRuta(con("owner"), ruta)).toBe(true);
  },
);

test("gerencia no tiene 'Mi cartera': no tiene ficha de vendedor", () => {
  expect(puedeVerRuta(con("owner"), "/mi-cartera")).toBe(false);
  expect(puedeVerRuta(con("superadmin"), "/mi-cartera")).toBe(false);
});

test.each([
  ["/dashboard", true],
  ["/conversaciones", true],
  ["/vendedores", true],
  ["/calendario", true],
  ["/preferencias", true],
  ["/agente", false],
  ["/canales", false],
  ["/herramientas", false],
  ["/suscripcion", false],
  ["/pagos/exito", false],
  ["/mi-cartera", false],
])("member en %s: %s", (ruta, esperado) => {
  expect(puedeVerRuta(con("member"), ruta)).toBe(esperado);
});

test.each([
  ["/mi-cartera", true],
  ["/preferencias", true],
  ["/conversaciones", true],
  ["/conversaciones/c-1", true],
  ["/dashboard", false],
  ["/vendedores", false],
  ["/vendedores/equipo", false],
  ["/calendario", false],
  ["/agente", false],
])("vendedor en %s: %s", (ruta, esperado) => {
  expect(puedeVerRuta(con("vendedor"), ruta)).toBe(esperado);
});

test("un rol desconocido solo ve su perfil y no queda en un círculo de redirecciones", () => {
  const raro = con("rol-nuevo");
  expect(puedeVerRuta(raro, "/dashboard")).toBe(false);
  expect(puedeVerRuta(raro, inicioDeRol(raro))).toBe(true);
});

test.each(["owner", "superadmin", "member", "vendedor"])("el inicio de %s es una ruta que puede ver", (role) => {
  const u = con(role);
  expect(puedeVerRuta(u, inicioDeRol(u))).toBe(true);
});

test("el vendedor arranca en su cartera", () => {
  expect(inicioDeRol(con("vendedor"))).toBe("/mi-cartera");
  expect(inicioDeRol(con("owner"))).toBe("/dashboard");
});

test.each([
  ["/calendario", true],
  ["/conversaciones", true],
  ["/conversaciones/c-1", true],
  ["/preferencias", true],
  // La agenda sí, las pestañas de gestión del calendario no.
  ["/calendario/proveedores", false],
  ["/calendario/servicios", false],
  ["/calendario/corte-diario", false],
  ["/calendario/auditoria", false],
  ["/dashboard", false],
  ["/vendedores", false],
  ["/mi-cartera", false],
])("proveedor en %s: %s", (ruta, esperado) => {
  expect(puedeVerRuta(con("proveedor"), ruta)).toBe(esperado);
});

test("el proveedor arranca en su agenda", () => {
  const u = con("proveedor");
  expect(inicioDeRol(u)).toBe("/calendario");
  expect(puedeVerRuta(u, inicioDeRol(u))).toBe(true);
});
