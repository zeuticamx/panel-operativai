/**
 * El menú solo ofrece lo que el rol puede abrir (lib/roles.ts).
 */
import { render, screen, within } from "@testing-library/react";

import { Sidebar } from "@/app/components/sidebar";
import { useUsuario } from "@/app/components/usuario-context";

jest.mock("next/navigation", () => ({
  usePathname: () => "/preferencias",
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/app/components/plan-context", () => ({ usePlan: () => ({ acceso: null }) }));
jest.mock("@/lib/foto-perfil", () => ({
  ...jest.requireActual("@/lib/foto-perfil"),
  useFotoPerfil: () => null,
}));

const mockUseUsuario = useUsuario as jest.Mock;

function destinos(role: string | null): (string | null)[] {
  mockUseUsuario.mockReturnValue({
    usuario: role && {
      id: "u",
      email: "ana@negocio.com",
      role,
      tenant_id: "t",
      nombre_negocio: "Ferretería",
      es_gerencia_plataforma: false,
      perfil_completo: true,
    },
    loading: role === null,
    error: null,
  });
  render(<Sidebar />);
  const nav = screen.getByRole("navigation", { name: "Principal" });
  return within(nav)
    .getAllByRole("link", { hidden: true })
    .map((a) => a.getAttribute("href"));
}

it("el vendedor ve su cartera y sus chats", () => {
  expect(destinos("vendedor")).toEqual(["/mi-cartera", "/conversaciones"]);
});

it("el colaborador ve la operación, no la configuración ni los pagos", () => {
  expect(destinos("member")).toEqual(["/dashboard", "/conversaciones", "/calendario", "/vendedores"]);
});

it("mientras carga el usuario no se ofrece ningún destino", () => {
  mockUseUsuario.mockReturnValue({ usuario: null, loading: true, error: null });
  render(<Sidebar />);
  const nav = screen.getByRole("navigation", { name: "Principal" });
  expect(within(nav).queryAllByRole("link")).toEqual([]);
});

it("la barra móvil del vendedor tiene su cartera, sus chats y el botón Más", () => {
  destinos("vendedor");
  const movil = screen.getByRole("navigation", { name: "Principal móvil", hidden: true });
  expect(within(movil).getAllByRole("link", { hidden: true }).map((a) => a.getAttribute("href"))).toEqual([
    "/mi-cartera",
    "/conversaciones",
  ]);
  expect(within(movil).getByRole("button", { name: /más/i, hidden: true })).toBeInTheDocument();
});

it("el proveedor ve sus chats y su agenda", () => {
  expect(destinos("proveedor")).toEqual(["/conversaciones", "/calendario"]);
});
