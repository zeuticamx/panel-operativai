"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { PlanActualizarIn, PlanCrearIn, PlanGerenciaOut } from "@/lib/types";
import { fmtInt, formatoMonto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { GerenciaTabs } from "@/app/components/gerencia";
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Interruptor,
  PageHeader,
  inputClass,
} from "@/app/components/ui";

/**
 * Catálogo de planes (tabla `planes`), administrado desde plataforma.
 *
 * Es la misma tabla que pinta la pantalla de suscripción del portal
 * (GET /api/pagos/catalogo, que solo trae los `activo`); acá se ven
 * también los apagados, para poder reactivarlos.
 */
export default function PlanesPage() {
  const planes = useApi<PlanGerenciaOut[]>("/api/gerencia/planes");
  const [editando, setEditando] = useState<PlanGerenciaOut | null>(null);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recargar = async (mensaje: string) => {
    setAviso(mensaje);
    setErrorAccion(null);
    await planes.recargar(true);
  };

  const alternarActivo = async (p: PlanGerenciaOut) => {
    setErrorAccion(null);
    setAviso(null);
    setOcupado(p.nombre);
    try {
      await apiFetch<PlanGerenciaOut>(`/api/gerencia/planes/${encodeURIComponent(p.nombre)}`, {
        method: "PATCH",
        json: { activo: !p.activo },
      });
      await planes.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo cambiar el plan."));
    } finally {
      setOcupado(null);
    }
  };

  const lista = planes.data ?? [];

  return (
    <>
      <PageHeader
        titulo="Planes"
        sub={planes.data ? `${fmtInt.format(lista.length)} en el catálogo` : undefined}
        acciones={
          <>
            <GerenciaTabs />
            <Boton variante="primario" onClick={() => setCreando(true)}>
              <Plus size={13} aria-hidden />
              Nuevo plan
            </Boton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {planes.error && <Aviso tipo="error">{planes.error}</Aviso>}
        {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        {!planes.data && planes.loading && <Cargando />}

        {planes.data && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] text-text-600">
              Esto es el catálogo — lo que un negocio ve al contratar (
              <code className="text-text-400">/api/pagos/catalogo</code>). Cambiarlo no toca a
              quien ya tiene un plan contratado.
            </p>

            <div className="overflow-x-auto rounded-md border border-bg-700">
              <table className="w-full min-w-[62rem] text-sm">
                <thead className="bg-bg-800 text-left font-mono text-[11px] text-text-600">
                  <tr>
                    <th className="px-3 py-2 font-normal">plan</th>
                    <th className="px-3 py-2 text-right font-normal">mensual</th>
                    <th className="px-3 py-2 text-right font-normal">anual</th>
                    <th className="px-3 py-2 text-right font-normal">créditos/mes</th>
                    <th className="px-3 py-2 text-right font-normal">vendedores</th>
                    <th className="px-3 py-2 text-right font-normal">leads/mes</th>
                    <th className="px-3 py-2 font-normal">servicios</th>
                    <th className="px-3 py-2 font-normal">activo</th>
                    <th className="px-3 py-2 font-normal" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr
                      key={p.nombre}
                      className={cn(
                        "border-t border-bg-700",
                        !p.activo && "opacity-50",
                      )}
                    >
                      <td className="max-w-[14rem] px-3 py-2">
                        <span className="block truncate text-text-100">{p.nombre}</span>
                        {p.descripcion && (
                          <span className="block truncate font-mono text-[11px] text-text-600">
                            {p.descripcion}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-100">
                        {formatoMonto(p.precio_monthly)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {formatoMonto(p.precio_annual)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {formatoMonto(p.creditos_incluidos_mensual)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {p.max_vendedores === null ? "sin tope" : fmtInt.format(p.max_vendedores)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {p.max_leads_mensuales === null
                          ? "sin tope"
                          : fmtInt.format(p.max_leads_mensuales)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={p.agente_ia_activo ? "success" : "neutral"}>
                            agente IA
                          </Badge>
                          <Badge tone={p.gestion_vendedores_activo ? "success" : "neutral"}>
                            vendedores
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Interruptor
                          label={`Plan ${p.nombre} activo`}
                          checked={p.activo}
                          disabled={ocupado !== null}
                          onChange={() => alternarActivo(p)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Boton
                          variante="fantasma"
                          onClick={() => setEditando(p)}
                          aria-label={`Editar ${p.nombre}`}
                        >
                          <Pencil size={13} aria-hidden />
                        </Boton>
                      </td>
                    </tr>
                  ))}

                  {lista.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-8 text-center font-mono text-[11px] text-text-600"
                      >
                        todavía no hay ningún plan en el catálogo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <FormularioPlan
        modo="crear"
        open={creando}
        onOpenChange={setCreando}
        onGuardado={(nombre) => recargar(`Plan "${nombre}" creado.`)}
      />
      {editando && (
        <FormularioPlan
          modo="editar"
          plan={editando}
          open={editando !== null}
          onOpenChange={(o) => !o && setEditando(null)}
          onGuardado={(nombre) => {
            setEditando(null);
            recargar(`Plan "${nombre}" actualizado.`);
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------
// Alta / edición
// ------------------------------------------------------------
/** "" en el input -> null en el body (sin tope / sin precio anual). */
function aOpcional(texto: string): string | null {
  const t = texto.trim();
  return t === "" ? null : t;
}

/** Vacío o un número >= 0. Mismo criterio que montoEstimado en CrearClienteForm. */
function numeroOpcionalValido(texto: string): boolean {
  const t = texto.trim();
  if (t === "") return true;
  return !Number.isNaN(Number(t)) && Number(t) >= 0;
}

function FormularioPlan({
  modo,
  plan,
  open,
  onOpenChange,
  onGuardado,
}: {
  modo: "crear" | "editar";
  plan?: PlanGerenciaOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardado: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioMonthly, setPrecioMonthly] = useState("");
  const [precioAnnual, setPrecioAnnual] = useState("");
  const [creditos, setCreditos] = useState("100");
  const [maxVendedores, setMaxVendedores] = useState("");
  const [maxLeads, setMaxLeads] = useState("");
  const [orden, setOrden] = useState("0");
  const [agenteIa, setAgenteIa] = useState(true);
  const [gestionVendedores, setGestionVendedores] = useState(true);
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, se parte del plan (editar) o de valores en blanco (crear).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetear el form al abrir es el patrón del resto del portal (ver CrearClienteForm).
    setNombre(plan?.nombre ?? "");
    setDescripcion(plan?.descripcion ?? "");
    setPrecioMonthly(plan?.precio_monthly ?? "");
    setPrecioAnnual(plan?.precio_annual ?? "");
    setCreditos(plan?.creditos_incluidos_mensual ?? "100");
    setMaxVendedores(plan?.max_vendedores?.toString() ?? "");
    setMaxLeads(plan?.max_leads_mensuales?.toString() ?? "");
    setOrden(plan?.orden?.toString() ?? "0");
    setAgenteIa(plan?.agente_ia_activo ?? true);
    setGestionVendedores(plan?.gestion_vendedores_activo ?? true);
    setActivo(plan?.activo ?? true);
    setError(null);
  }, [open, plan]);

  const nombreValido = modo === "editar" || (nombre.trim().length >= 2 && nombre.length <= 100);
  const precioValido =
    precioMonthly.trim() !== "" && !Number.isNaN(Number(precioMonthly)) && Number(precioMonthly) >= 0;
  const camposOpcionalesValidos =
    numeroOpcionalValido(precioAnnual) &&
    numeroOpcionalValido(creditos) &&
    numeroOpcionalValido(maxVendedores) &&
    numeroOpcionalValido(maxLeads) &&
    numeroOpcionalValido(orden);
  const puedeGuardar = nombreValido && precioValido && camposOpcionalesValidos && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      if (modo === "crear") {
        const body: PlanCrearIn = {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          precio_monthly: precioMonthly.trim(),
          precio_annual: aOpcional(precioAnnual),
          creditos_incluidos_mensual: aOpcional(creditos) ?? undefined,
          max_vendedores: aOpcional(maxVendedores) === null ? null : Number(maxVendedores),
          max_leads_mensuales: aOpcional(maxLeads) === null ? null : Number(maxLeads),
          orden: aOpcional(orden) === null ? undefined : Number(orden),
          agente_ia_activo: agenteIa,
          gestion_vendedores_activo: gestionVendedores,
          activo,
        };
        await apiFetch<PlanGerenciaOut>("/api/gerencia/planes", { method: "POST", json: body });
        onGuardado(body.nombre);
      } else if (plan) {
        const body: PlanActualizarIn = {
          descripcion: descripcion.trim() || null,
          precio_monthly: precioMonthly.trim(),
          precio_annual: aOpcional(precioAnnual),
          creditos_incluidos_mensual: aOpcional(creditos),
          max_vendedores: aOpcional(maxVendedores) === null ? null : Number(maxVendedores),
          max_leads_mensuales: aOpcional(maxLeads) === null ? null : Number(maxLeads),
          orden: aOpcional(orden) === null ? null : Number(orden),
          agente_ia_activo: agenteIa,
          gestion_vendedores_activo: gestionVendedores,
          activo,
        };
        await apiFetch<PlanGerenciaOut>(
          `/api/gerencia/planes/${encodeURIComponent(plan.nombre)}`,
          { method: "PATCH", json: body },
        );
        onGuardado(plan.nombre);
      }
    } catch (e) {
      setError(mensajeDeError(e, "No se pudieron guardar los cambios."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !guardando && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="text-sm font-medium text-text-100">
                {modo === "crear" ? "Nuevo plan" : `Editar ${plan?.nombre}`}
              </Dialog.Title>
              {modo === "editar" && (
                <Dialog.Description className="font-mono text-[11px] text-text-600">
                  el nombre no se puede cambiar acá
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Boton
                variante="fantasma"
                disabled={guardando}
                aria-label="Cerrar"
                className="min-h-8 shrink-0 px-2"
              >
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            <Campo id="plan-nombre" label="Nombre" hint="2-100 caracteres, no se puede cambiar después">
              <input
                id="plan-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={guardando || modo === "editar"}
                placeholder="starter, pro, enterprise…"
                maxLength={100}
                className={inputClass}
              />
            </Campo>

            <Campo id="plan-descripcion" label="Descripción" hint="Opcional">
              <input
                id="plan-descripcion"
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={guardando}
                placeholder="Plan básico para pequeños negocios"
                maxLength={2000}
                className={inputClass}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo id="plan-precio-mensual" label="Precio mensual">
                <input
                  id="plan-precio-mensual"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={precioMonthly}
                  onChange={(e) => setPrecioMonthly(e.target.value)}
                  disabled={guardando}
                  placeholder="199.00"
                  className={inputClass}
                />
              </Campo>
              <Campo id="plan-precio-anual" label="Precio anual" hint="Opcional">
                <input
                  id="plan-precio-anual"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={precioAnnual}
                  onChange={(e) => setPrecioAnnual(e.target.value)}
                  disabled={guardando}
                  placeholder="sin descuento anual"
                  className={inputClass}
                />
              </Campo>
            </div>

            <Campo id="plan-creditos" label="Créditos incluidos por mes">
              <input
                id="plan-creditos"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={creditos}
                onChange={(e) => setCreditos(e.target.value)}
                disabled={guardando}
                className={inputClass}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo id="plan-max-vendedores" label="Máx. vendedores" hint="vacío = sin tope">
                <input
                  id="plan-max-vendedores"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxVendedores}
                  onChange={(e) => setMaxVendedores(e.target.value)}
                  disabled={guardando}
                  placeholder="sin tope"
                  className={inputClass}
                />
              </Campo>
              <Campo id="plan-max-leads" label="Máx. leads/mes" hint="vacío = sin tope">
                <input
                  id="plan-max-leads"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxLeads}
                  onChange={(e) => setMaxLeads(e.target.value)}
                  disabled={guardando}
                  placeholder="sin tope"
                  className={inputClass}
                />
              </Campo>
            </div>

            <Campo id="plan-orden" label="Orden" hint="menor sale primero en el catálogo">
              <input
                id="plan-orden"
                type="number"
                inputMode="numeric"
                min={0}
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                disabled={guardando}
                className={inputClass}
              />
            </Campo>

            <div className="flex flex-col gap-3 border-t border-bg-700 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-100">Incluye agente de IA</span>
                <Interruptor
                  label="Incluye agente de IA"
                  checked={agenteIa}
                  disabled={guardando}
                  onChange={setAgenteIa}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-100">Incluye gestión de vendedores</span>
                <Interruptor
                  label="Incluye gestión de vendedores"
                  checked={gestionVendedores}
                  disabled={guardando}
                  onChange={setGestionVendedores}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-100">Visible en el catálogo</span>
                <Interruptor
                  label="Visible en el catálogo"
                  checked={activo}
                  disabled={guardando}
                  onChange={setActivo}
                />
              </div>
            </div>
          </div>

          <footer className="flex justify-end gap-2 border-t border-bg-700 px-5 py-3">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton
              variante="primario"
              onClick={guardar}
              loading={guardando}
              disabled={!puedeGuardar}
            >
              Guardar
            </Boton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
