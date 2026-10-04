/**
 * El acceso al perfil en el panel de cuenta del sidebar, con indicador
 * mientras falten datos, sin tocar la navegación principal.
 */
import { render, screen, within } from "@testing-library/react";

import { Sidebar } from "@/app/components/sidebar";
import { useUsuario } from "@/app/components/usuario-context";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/app/components/plan-context", () => ({ usePlan: () => ({ acceso: null }) }));
jest.mock("@/lib/foto-perfil", () => ({
  ...jest.requireActual("@/lib/foto-perfil"),
  useFotoPerfil: () => null,
}));

const mockUseUsuario = useUsuario as jest.Mock;

function conUsuario(extra: Record<string, unknown>) {
  mockUseUsuario.mockReturnValue({
    usuario: {
      id: "u",
      email: "ana@negocio.com",
      role: "owner",
      tenant_id: "t",
      nombre_negocio: "Ferretería",
      es_gerencia_plataforma: false,
      ...extra,
    },
    loading: false,
    error: null,
  });
}

it("con el perfil incompleto, el acceso al pie avisa que falta completarlo", () => {
  conUsuario({ perfil_completo: false });
  render(<Sidebar />);

  const acceso = screen.getByText("completa tu perfil").closest("a") as HTMLElement;
  expect(acceso).toHaveAttribute("href", "/preferencias");
  expect(within(acceso).getByText("ana@negocio.com")).toBeInTheDocument();
});

it("con el perfil completo muestra el nombre y ya no avisa", () => {
  conUsuario({ perfil_completo: true, nombres: "Ana", apellido_paterno: "Pérez" });
  render(<Sidebar />);

  const acceso = screen.getByText("Ana Pérez").closest("a") as HTMLElement;
  expect(acceso).toHaveAttribute("href", "/preferencias");
  expect(screen.queryByText("completa tu perfil")).not.toBeInTheDocument();
  // Las iniciales hacen de avatar cuando no hay foto.
  expect(within(acceso).getByText("AP")).toBeInTheDocument();
});

it("ya no hay tarjeta del negocio bajo el logo: el correo solo aparece en el acceso al perfil", () => {
  conUsuario({ perfil_completo: false });
  render(<Sidebar />);

  expect(screen.queryByText("Ferretería")).not.toBeInTheDocument();
  const correos = screen.getAllByText("ana@negocio.com");
  expect(correos).toHaveLength(1);
  expect(correos[0].closest("a")).toHaveAttribute("href", "/preferencias");
});

it("la navegación principal agrupa operación diaria antes que configuración", () => {
  conUsuario({ perfil_completo: false });
  render(<Sidebar />);

  const nav = screen.getByRole("navigation", { name: "Principal" });
  const destinos = within(nav)
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"));
  expect(destinos).toEqual([
    "/dashboard",
    "/conversaciones",
    "/calendario",
    "/canales",
    "/agente",
    "/herramientas",
    "/vendedores",
    "/suscripcion",
  ]);
});
