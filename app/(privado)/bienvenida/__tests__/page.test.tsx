/**
 * /bienvenida: el recorrido de pasos, lo que se manda al guardar y al
 * aplicar, omitir, y la confirmación para reemplazar un prompt editado.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BienvenidaPage from "@/app/(privado)/bienvenida/page";
import { usePlan } from "@/app/components/plan-context";
import { useUsuario } from "@/app/components/usuario-context";
import { apiFetch } from "@/lib/auth";
import type { OnboardingAplicado, OnboardingOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => "/bienvenida",
}));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/app/components/plan-context", () => ({ usePlan: jest.fn() }));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.Mock;
const recargarUsuario = jest.fn();
const recargarPlan = jest.fn(async () => {});

const PENDIENTE: OnboardingOut = {
  estado: "pendiente",
  respuestas: null,
  recomendacion: null,
  prueba_disponible: true,
  dias_prueba: 14,
  prompt_editado: false,
};

function vistaPrevia(extra: Partial<OnboardingOut> = {}): OnboardingOut {
  return {
    ...PENDIENTE,
    recomendacion: {
      system_prompt: "Eres el asistente virtual de Barbería Ana, una barbería...",
      modulos: ["agente", "calendario"],
      plan: {
        nombre: "pro",
        precio_monthly: "99.99",
        herramientas: ["agente", "vendedores", "herramientas", "crm_campo", "calendario"],
        max_vendedores: 15,
        max_proveedores: 10,
        cubre_todo: true,
        faltantes: [],
      },
    },
    ...extra,
  };
}

const APLICADO: OnboardingAplicado = {
  prompt_actualizado: true,
  modulos_encendidos: ["agente", "calendario"],
  modulos_pendientes: [],
  prueba: { plan: "pro", vence: "2026-10-22T12:00:00Z" },
  plan_recomendado: "pro",
};

beforeEach(() => {
  mockApiFetch.mockReset();
  replace.mockClear();
  recargarUsuario.mockClear();
  recargarPlan.mockClear();
  (useApi as jest.Mock).mockReturnValue({ data: PENDIENTE, loading: false, error: null, recargar: jest.fn() });
  (useUsuario as jest.Mock).mockReturnValue({
    usuario: { id: "u", email: "ana@x.com", role: "owner", tenant_id: "t", nombre_negocio: "Barbería Ana" },
    loading: false,
    error: null,
    recargar: recargarUsuario,
  });
  (usePlan as jest.Mock).mockReturnValue({ recargar: recargarPlan });
});

async function llegarAlResumen(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Barbería, salón o spa/ }));
  await user.click(screen.getByRole("button", { name: /Siguiente/ }));
  await user.click(screen.getByRole("button", { name: /Siguiente/ }));
  await user.click(screen.getByRole("button", { name: /Ver recomendación/ }));
}

it("guarda las respuestas al llegar al resumen y aplica con prueba", async () => {
  const user = userEvent.setup();
  mockApiFetch.mockResolvedValueOnce(vistaPrevia()).mockResolvedValueOnce(APLICADO);
  render(<BienvenidaPage />);

  await llegarAlResumen(user);

  expect(mockApiFetch).toHaveBeenCalledWith(
    "/api/onboarding",
    expect.objectContaining({
      method: "PUT",
      json: expect.objectContaining({ giro: "salon_belleza", agenda_citas: true, canales: ["whatsapp"] }),
    }),
  );
  expect(await screen.findByText("PLAN RECOMENDADO")).toBeInTheDocument();
  expect(screen.getByText(/gratis por 14 días/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Aplicar configuración/ }));

  expect(mockApiFetch).toHaveBeenLastCalledWith("/api/onboarding/aplicar", {
    method: "POST",
    json: { sobrescribir_prompt: false },
  });
  expect(await screen.findByText(/Tu agente está configurado/)).toBeInTheDocument();
  expect(recargarUsuario).toHaveBeenCalled();
  expect(recargarPlan).toHaveBeenCalled();
});

it("pide confirmación para reemplazar un prompt escrito a mano", async () => {
  const user = userEvent.setup();
  mockApiFetch.mockResolvedValueOnce(vistaPrevia({ prompt_editado: true })).mockResolvedValueOnce(APLICADO);
  render(<BienvenidaPage />);

  await llegarAlResumen(user);
  await user.click(await screen.findByRole("switch", { name: "Reemplazar mis instrucciones" }));
  await user.click(screen.getByRole("button", { name: /Aplicar configuración/ }));

  expect(mockApiFetch).toHaveBeenLastCalledWith("/api/onboarding/aplicar", {
    method: "POST",
    json: { sobrescribir_prompt: true },
  });
});

it("el número de personas que atienden citas solo aparece si agenda citas", async () => {
  const user = userEvent.setup();
  render(<BienvenidaPage />);

  await user.click(screen.getByRole("radio", { name: /Tienda/ }));
  await user.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(screen.queryByLabelText(/Cuántas personas atienden citas/)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Cuántos vendedores tienes/)).toBeInTheDocument();

  await user.click(screen.getByRole("switch", { name: "Mis clientes reservan citas" }));
  expect(screen.getByLabelText(/Cuántas personas atienden citas/)).toBeInTheDocument();
});

it("omitir avisa al backend y vuelve al dashboard", async () => {
  const user = userEvent.setup();
  mockApiFetch.mockResolvedValueOnce(undefined);
  render(<BienvenidaPage />);

  await user.click(screen.getByRole("button", { name: "Omitir por ahora" }));

  expect(mockApiFetch).toHaveBeenCalledWith("/api/onboarding/omitir", { method: "POST" });
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  expect(recargarUsuario).toHaveBeenCalled();
});

it("muestra el error del backend sin avanzar", async () => {
  const user = userEvent.setup();
  mockApiFetch.mockRejectedValueOnce(new Error("Modo solo lectura"));
  render(<BienvenidaPage />);

  await llegarAlResumen(user);

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("PLAN RECOMENDADO")).not.toBeInTheDocument();
});
