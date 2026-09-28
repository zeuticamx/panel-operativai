/**
 * Vista y modal de bloqueo por plan, y la guarda del layout que decide
 * cuándo mostrarlos (plan-context.tsx).
 *
 * Se mockean la ruta (next/navigation), la sesión (usuario-context), la
 * consulta de /pagos/acceso (useApi) y la campana (su socket): lo que se
 * prueba es qué ve la persona en cada caso, y que el bloqueo nunca tenga
 * tono de error.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BloqueoPlanModal } from "@/app/components/bloqueo-plan";
import { GuardaPlan, PlanProvider } from "@/app/components/plan-context";
import { useUsuario } from "@/app/components/usuario-context";
import { PLAN_BLOQUEADO_EVENT } from "@/lib/auth";
import type { AccesoPlanOut, BloqueoPlanDetalle, Herramienta } from "@/lib/types";
import { useApi } from "@/lib/use-api";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));

const mockUseUsuario = useUsuario as jest.Mock;
const mockUseApi = useApi as jest.Mock;

const TODAS: Herramienta[] = ["agente", "vendedores", "herramientas", "crm_campo", "calendario"];
const ACCESO_STARTER: AccesoPlanOut = {
  estado: "vigente",
  plan: "starter",
  herramientas: ["agente", "vendedores"],
  planes: [
    { nombre: "starter", herramientas: ["agente", "vendedores"] },
    { nombre: "pro", herramientas: TODAS },
  ],
};

const INSUFICIENTE: BloqueoPlanDetalle = {
  codigo: "plan_insuficiente",
  herramienta: "calendario",
  estado: "vigente",
  plan_actual: "starter",
  planes_que_la_incluyen: ["pro"],
  mensaje: "",
};

function comoRol(role: string) {
  mockUseUsuario.mockReturnValue({
    usuario: { id: "u", email: "a@b.c", full_name: null, role, tenant_id: "t" },
    loading: false,
    error: null,
  });
}

function conAcceso(data: AccesoPlanOut | null, loading = false) {
  mockUseApi.mockReturnValue({ data, loading, error: null, recargar: jest.fn() });
}

beforeEach(() => {
  mockPathname = "/dashboard";
  comoRol("owner");
  conAcceso(ACCESO_STARTER);
});

describe("BloqueoPlanModal", () => {
  it("plan insuficiente: dice en qué plan está y lleva a ese plan", () => {
    render(<BloqueoPlanModal bloqueo={INSUFICIENTE} onCerrar={jest.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Calendario está en el plan Pro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver plan Pro" })).toHaveAttribute(
      "href",
      "/suscripcion?plan=pro",
    );
  });

  it("no tiene tono de error: nada de role=alert", () => {
    render(<BloqueoPlanModal bloqueo={INSUFICIENTE} onCerrar={jest.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("'Ahora no' lo cierra", async () => {
    const onCerrar = jest.fn();
    render(<BloqueoPlanModal bloqueo={INSUFICIENTE} onCerrar={onCerrar} />);

    await userEvent.click(screen.getByRole("button", { name: "Ahora no" }));

    expect(onCerrar).toHaveBeenCalled();
  });

  it("quien no es dueño no ve el CTA de compra, sino a quién pedírselo", () => {
    comoRol("member");
    render(<BloqueoPlanModal bloqueo={INSUFICIENTE} onCerrar={jest.fn()} />);

    expect(screen.queryByRole("link", { name: /Ver plan/ })).not.toBeInTheDocument();
    expect(screen.getByText(/pídele al dueño del negocio/)).toBeInTheDocument();
  });

  it("plan vencido: invita a renovar", () => {
    render(
      <BloqueoPlanModal
        bloqueo={{ ...INSUFICIENTE, codigo: "plan_requerido", estado: "vencido", plan_actual: "pro" }}
        onCerrar={jest.fn()}
      />,
    );

    expect(screen.getByText("Tu plan no está activo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renovar plan" })).toHaveAttribute(
      "href",
      "/suscripcion?plan=pro",
    );
  });

  it("cuenta suspendida: sin botón de pago", () => {
    render(
      <BloqueoPlanModal
        bloqueo={{ ...INSUFICIENTE, codigo: "cuenta_suspendida", estado: "suspendido" }}
        onCerrar={jest.fn()}
      />,
    );

    expect(screen.getByText("Tu cuenta está en pausa")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /plan/i })).not.toBeInTheDocument();
  });

  it("cerrado cuando no hay bloqueo", () => {
    render(<BloqueoPlanModal bloqueo={null} onCerrar={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

function renderGuarda() {
  return render(
    <PlanProvider>
      <GuardaPlan>
        <p>contenido de la pantalla</p>
      </GuardaPlan>
    </PlanProvider>,
  );
}

describe("GuardaPlan", () => {
  it("una pantalla fuera del plan muestra la vista de bloqueo y no monta la página", () => {
    mockPathname = "/calendario";
    renderGuarda();

    expect(screen.getByRole("heading", { name: "Calendario está en el plan Pro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver plan Pro" })).toBeInTheDocument();
    expect(screen.queryByText("contenido de la pantalla")).not.toBeInTheDocument();
  });

  it("una pantalla incluida en el plan se muestra normal", () => {
    mockPathname = "/agente";
    renderGuarda();

    expect(screen.getByText("contenido de la pantalla")).toBeInTheDocument();
  });

  it("mientras carga el plan no monta una pantalla de herramienta", () => {
    mockPathname = "/calendario";
    conAcceso(null, true);
    renderGuarda();

    expect(screen.queryByText("contenido de la pantalla")).not.toBeInTheDocument();
  });

  it("si /pagos/acceso falla no tapa nada (el backend decide igual)", () => {
    mockPathname = "/calendario";
    conAcceso(null, false);
    renderGuarda();

    expect(screen.getByText("contenido de la pantalla")).toBeInTheDocument();
  });

  it("plan vencido: muestra la franja para renovar, sin bloquear el inicio", () => {
    conAcceso({ ...ACCESO_STARTER, estado: "vencido", herramientas: [] });
    renderGuarda();

    expect(screen.getByText(/Tu plan venció/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renovar" })).toHaveAttribute(
      "href",
      "/suscripcion?plan=starter",
    );
    expect(screen.getByText("contenido de la pantalla")).toBeInTheDocument();
  });

  it("un 402 de una acción en mitad de la sesión abre el modal", () => {
    mockPathname = "/agente";
    renderGuarda();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(PLAN_BLOQUEADO_EVENT, { detail: INSUFICIENTE }));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Calendario está en el plan Pro")).toBeInTheDocument();
  });
});
