"use client";

import { useState } from "react";
import { Bot, Users } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { ServiciosOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { esGerencia, useServicios } from "./modulo-vendedores";
import { Aviso, ConfirmDialog, Interruptor } from "./ui";
import { useUsuario } from "./usuario-context";

/**
 * Servicios del negocio (agente de IA / gestión de vendedores). Vive en
 * Preferencias, no en Vendedores, para que un dueño sin el módulo de ventas
 * pueda activarlo o apagar el agente igual. Solo gerencia puede cambiarlos.
 */
export function ServiciosNegocio({ soloLectura = false }: { soloLectura?: boolean }) {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [apagarModulo, setApagarModulo] = useState(false);

  const patchServicios = async (cambio: Partial<ServiciosOut>) => {
    if (!servicios.tenantId) return;
    setError(null);
    setOcupado(true);
    try {
      await apiFetch<ServiciosOut>(`/api/tenants/${servicios.tenantId}/servicios`, {
        method: "PATCH",
        json: cambio,
      });
      await servicios.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cambiar el servicio."));
    } finally {
      setOcupado(false);
    }
  };

  const s = servicios.data;
  const bloqueado = !gerencia || soloLectura || ocupado;

  return (
    <section
      data-tour="preferencias.servicios"
      className="rounded-md border border-bg-700 bg-bg-900 p-4"
    >
      <header className="mb-3">
        <h2 className="text-sm font-medium text-text-100">Servicios del negocio</h2>
        <p className="font-mono text-[11px] text-text-600">
          funcionan por separado: puedes tener uno, el otro o los dos
        </p>
      </header>

      {(servicios.error || error) && <Aviso tipo="error">{servicios.error ?? error}</Aviso>}

      <div className="flex flex-col divide-y divide-bg-700">
        <FilaServicio
          icono={Bot}
          titulo="Agente de IA"
          descripcion="Contesta a los clientes en automático. Si lo apagas, cada lead nuevo dispara un aviso directo al vendedor asignado."
          checked={s?.agente_ia_activo ?? true}
          disabled={bloqueado || !s}
          onChange={(v) => patchServicios({ agente_ia_activo: v })}
        />
        <FilaServicio
          icono={Users}
          titulo="Gestión de vendedores"
          descripcion="Embudo de venta y reparto de leads. Al apagarlo, los datos se conservan pero el equipo deja de recibir clientes."
          checked={s?.gestion_vendedores_activo ?? false}
          disabled={bloqueado || !s}
          onChange={(v) =>
            v ? patchServicios({ gestion_vendedores_activo: true }) : setApagarModulo(true)
          }
        />
      </div>
      {!gerencia && (
        <p className="mt-3 font-mono text-[11px] text-text-600">
          solo el dueño del negocio puede cambiar esto
        </p>
      )}

      <ConfirmDialog
        open={apagarModulo}
        onOpenChange={(o) => {
          if (!o && !ocupado) setApagarModulo(false);
        }}
        titulo="¿Apagar la gestión de vendedores?"
        descripcion="El equipo deja de recibir clientes nuevos y la sección de vendedores se oculta. El embudo y el historial se conservan; al volver a activarlo todo sigue donde estaba."
        confirmar="Apagar"
        peligro
        loading={ocupado}
        onConfirm={async () => {
          await patchServicios({ gestion_vendedores_activo: false });
          setApagarModulo(false);
        }}
      />
    </section>
  );
}

function FilaServicio({
  icono: Icono,
  titulo,
  descripcion,
  checked,
  disabled,
  onChange,
}: {
  icono: typeof Bot;
  titulo: string;
  descripcion: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
          checked
            ? "border-success/40 bg-success-bg text-success"
            : "border-bg-700 bg-bg-800 text-text-400",
        )}
      >
        <Icono size={16} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-text-100">{titulo}</span>
        <p className="text-xs leading-relaxed text-text-400">{descripcion}</p>
      </div>
      <Interruptor
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={titulo}
        className="mt-1"
      />
    </div>
  );
}
