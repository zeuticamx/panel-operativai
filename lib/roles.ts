import type { UsuarioOut } from "./types";

/**
 * Qué pantallas del portal ve cada rol de un negocio.
 *
 * Espejo de las guardas del backend (deps.negocio_actual, gerencia_actual,
 * vendedor_actual): el backend vuelve a decidir en cada petición. Esto es
 * para no mostrar una pantalla que solo va a recibir 403, no la seguridad.
 *
 *   owner / superadmin  todo
 *   member              opera el negocio; no ve configuración ni pagos
 *   vendedor            solo su cartera y su perfil
 *   proveedor           su agenda (/calendario, sin las pestañas de gestión),
 *                       las conversaciones de sus clientes y su perfil
 *
 * /gerencia (plataforma) no pasa por acá: tiene su propia guarda en
 * app/(privado)/gerencia/layout.tsx.
 */

export const ROL_LABEL: Record<string, string> = {
  owner: "Dueño",
  superadmin: "Administrador",
  member: "Colaborador",
  vendedor: "Vendedor",
  proveedor: "Proveedor",
};

export function etiquetaRol(role: string): string {
  return ROL_LABEL[role] ?? role;
}

/** Lo único que miran estas funciones: el rol. */
type ConRol = Pick<UsuarioOut, "role"> | null;

export function esVendedor(usuario: ConRol): boolean {
  return usuario?.role === "vendedor";
}

export function esProveedor(usuario: ConRol): boolean {
  return usuario?.role === "proveedor";
}

/** Lo único que abre un vendedor. */
const RUTAS_VENDEDOR = ["/mi-cartera", "/preferencias"];

/**
 * Lo que abre un proveedor del calendario. "/calendario" es exacto: la
 * agenda sí, sus pestañas de gestión (proveedores, servicios, corte,
 * bitácora) no. El backend ya le filtra la agenda y las conversaciones.
 */
const RUTAS_PROVEEDOR_PREFIJO = ["/conversaciones", "/preferencias"];
const RUTAS_PROVEEDOR_EXACTAS = ["/calendario"];

/** Configuración del negocio y pagos: el backend se los niega a 'member'. */
const RUTAS_SOLO_GERENCIA = ["/agente", "/canales", "/herramientas", "/suscripcion", "/pagos"];

function bajo(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(prefijo + "/");
}

/** A dónde va cada rol al entrar (y cuando abre una ruta que no le toca). */
export function inicioDeRol(usuario: ConRol): string {
  if (!usuario) return "/dashboard";
  if (esVendedor(usuario)) return "/mi-cartera";
  if (esProveedor(usuario)) return "/calendario";
  // Tiene que ser una ruta que `puedeVerRuta` le deje abrir, o la guarda
  // redirigiría en círculo.
  return ["owner", "superadmin", "member"].includes(usuario.role) ? "/dashboard" : "/preferencias";
}

export function puedeVerRuta(usuario: ConRol, pathname: string): boolean {
  if (!usuario) return true;
  if (bajo(pathname, "/gerencia")) return true;

  switch (usuario.role) {
    case "owner":
    case "superadmin":
      // "Mi cartera" es la vista del vendedor: gerencia no tiene ficha propia.
      return !bajo(pathname, "/mi-cartera");
    case "member":
      return !bajo(pathname, "/mi-cartera") && !RUTAS_SOLO_GERENCIA.some((r) => bajo(pathname, r));
    case "vendedor":
      return RUTAS_VENDEDOR.some((r) => bajo(pathname, r));
    case "proveedor":
      return (
        RUTAS_PROVEEDOR_EXACTAS.includes(pathname) || RUTAS_PROVEEDOR_PREFIJO.some((r) => bajo(pathname, r))
      );
    default:
      // Rol desconocido: solo su perfil, igual que el backend (lista blanca).
      return bajo(pathname, "/preferencias");
  }
}
