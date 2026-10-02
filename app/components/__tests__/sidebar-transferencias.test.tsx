/** Badge de «Conversaciones» en el sidebar mientras haya transferencias sin atender. */
import { render, screen, within } from "@testing-library/react";

import { useAlertas } from "@/app/components/alertas-context";
import { Sidebar } from "@/app/components/sidebar";
import type { AlertaOut } from "@/lib/types";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/app/components/usuario-context", () => ({
  useUsuario: () => ({
    usuario: { id: "u", email: "a@b.com", role: "owner", tenant_id: "t", es_gerencia_plataforma: false },
  }),
}));
jest.mock("@/app/components/plan-context", () => ({ usePlan: () => ({ acceso: null }) }));
jest.mock("@/app/components/alertas-context", () => ({ useAlertas: jest.fn() }));
jest.mock("@/lib/foto-perfil", () => ({
  ...jest.requireActual("@/lib/foto-perfil"),
  useFotoPerfil: () => null,
}));

const mockUseAlertas = useAlertas as jest.Mock;

function alerta(id: string, leido: boolean): AlertaOut {
  return {
    id,
    tenant_id: "t",
    tipo: "conversacion_transferida",
    titulo: "x",
    mensaje: "y",
    datos: { conversation_id: id },
    leido,
    creado_en: "2026-01-10T15:30:00Z",
  };
}

function enlaceConversaciones() {
  const nav = screen.getByRole("navigation", { name: "Principal" });
  return within(nav).getAllByRole("link").find((a) => a.getAttribute("href") === "/conversaciones")!;
}

test("muestra el contador de transferencias pendientes", () => {
  mockUseAlertas.mockReturnValue({ alertas: [alerta("1", false), alerta("2", false), alerta("3", true)] });
  render(<Sidebar />);
  expect(within(enlaceConversaciones()).getByRole("status")).toHaveTextContent("2");
});

test("sin pendientes no hay badge", () => {
  mockUseAlertas.mockReturnValue({ alertas: [alerta("1", true)] });
  render(<Sidebar />);
  expect(within(enlaceConversaciones()).queryByRole("status")).not.toBeInTheDocument();
});
