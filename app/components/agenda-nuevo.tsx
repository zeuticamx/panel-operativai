"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { TIPO_INFO, aInputLocal, deInputLocal, fechaCorta, nombreLead } from "@/lib/agenda";
import type { ClienteOut, PipelineOut, TipoPendiente, VendedorOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { Aviso, Boton, Campo, inputClass, selectClass } from "./ui";

/**
 * Alta de un pendiente desde la agenda (clic en un día vacío o "Nuevo").
 *
 * Una tarea va contra POST /tareas, que exige un cliente de campo; un
 * seguimiento es poner fecha a un lead que ya existe (PUT
 * /agenda/seguimientos), así que se elige de la lista de leads abiertos. Si
 * el lead ya tenía uno agendado, esto lo mueve: un lead tiene un solo
 * "próximo seguimiento" y el selector lo dice antes de guardar.
 */
export function AgendaNuevo({
  fecha,
  tareasDisponibles,
  seguimientosDisponibles,
  esVendedor,
  vendedores,
  leads,
  onClose,
  onCreado,
}: {
  fecha: Date;
  tareasDisponibles: boolean;
  seguimientosDisponibles: boolean;
  /** El vendedor crea solo para sí: el backend ignora otro vendedor_id. */
  esVendedor: boolean;
  vendedores: VendedorOut[];
  leads: PipelineOut[];
  onClose: () => void;
  onCreado: (mensaje: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoPendiente>(tareasDisponibles ? "tarea" : "seguimiento");
  const [cuando, setCuando] = useState(aInputLocal(fecha));
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientes = useApi<ClienteOut[]>(tipo === "tarea" ? "/api/clientes?limite=500" : null);
  const lead = leads.find((l) => l.user_id === leadId) ?? null;

  const elegirCliente = (id: string) => {
    setClienteId(id);
    // Por defecto, el vendedor que ya visita a ese cliente.
    const c = clientes.data?.find((x) => x.id === id);
    if (c?.vendedor_id) setVendedorId(c.vendedor_id);
  };

  const guardar = async () => {
    if (guardando) return;
    const iso = deInputLocal(cuando);
    setError(null);
    if (!iso) return setError("Elige una fecha y hora válidas.");

    setGuardando(true);
    try {
      if (tipo === "tarea") {
        if (!clienteId) throw new Error("Elige el cliente de campo.");
        if (titulo.trim().length < 2) throw new Error("Escribe qué hay que hacer (2 caracteres o más).");
        if (!esVendedor && !vendedorId) throw new Error("Elige a qué vendedor le toca.");
        await apiFetch("/api/tareas", {
          method: "POST",
          json: {
            cliente_id: clienteId,
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            fecha_programada: iso,
            ...(esVendedor ? {} : { vendedor_id: vendedorId }),
          },
        });
        onCreado(`«${titulo.trim()}» quedó para el ${fechaCorta(iso)}.`);
      } else {
        if (!lead) throw new Error("Elige el lead al que le vas a dar seguimiento.");
        await apiFetch(`/api/agenda/seguimientos/${lead.user_id}`, {
          method: "PUT",
          json: { fecha: iso, nota: titulo.trim() },
        });
        onCreado(`Seguimiento a ${nombreLead(lead)} agendado para el ${fechaCorta(iso)}.`);
      }
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo agendar."));
      setGuardando(false);
    }
  };

  const tipos = (["tarea", "seguimiento"] as const).filter((t) =>
    t === "tarea" ? tareasDisponibles : seguimientosDisponibles,
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o && !guardando) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-sm font-medium text-text-100">Agendar pendiente</Dialog.Title>
            <Dialog.Description className="text-xs text-text-400">
              Aparece en la agenda y en la app del vendedor.
            </Dialog.Description>
          </div>

          {tipos.length > 1 && (
            <div role="radiogroup" aria-label="Tipo de pendiente" className="grid grid-cols-2 gap-2">
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left text-xs",
                    tipo === t
                      ? "border-bg-600 bg-bg-800 text-text-100"
                      : "border-bg-700 text-text-400 hover:bg-hover",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-3 w-1 rounded-full", t === "tarea" ? "bg-series-1" : "bg-series-2")}
                  />
                  {TIPO_INFO[t].label}
                </button>
              ))}
            </div>
          )}

          {tipo === "tarea" ? (
            <>
              <Campo id="nuevo-cliente" label="Cliente de campo" error={clientes.error}>
                <select
                  id="nuevo-cliente"
                  value={clienteId}
                  onChange={(e) => elegirCliente(e.target.value)}
                  className={selectClass}
                  disabled={!clientes.data}
                >
                  <option value="">{clientes.data ? "Elige un cliente" : "cargando…"}</option>
                  {(clientes.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_negocio}
                    </option>
                  ))}
                </select>
              </Campo>
              {!esVendedor && (
                <Campo id="nuevo-vendedor" label="Vendedor">
                  <select
                    id="nuevo-vendedor"
                    value={vendedorId}
                    onChange={(e) => setVendedorId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Elige un vendedor</option>
                    {vendedores
                      .filter((v) => v.activo)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre}
                        </option>
                      ))}
                  </select>
                </Campo>
              )}
            </>
          ) : (
            <Campo
              id="nuevo-lead"
              label="Lead"
              hint={
                lead?.proximo_seguimiento
                  ? `ya tiene uno el ${fechaCorta(lead.proximo_seguimiento)}: se va a mover`
                  : leads.length === 0
                    ? "no hay leads abiertos"
                    : undefined
              }
            >
              <select
                id="nuevo-lead"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className={selectClass}
              >
                <option value="">Elige un lead</option>
                {leads.map((l) => (
                  <option key={l.user_id} value={l.user_id}>
                    {nombreLead(l)}
                    {!esVendedor && l.vendedor_nombre ? ` · ${l.vendedor_nombre}` : ""}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <Campo id="nuevo-titulo" label={tipo === "tarea" ? "Qué hay que hacer" : "Nota (opcional)"}>
            <input
              id="nuevo-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === "tarea" ? "Llevar muestras del producto nuevo" : "Mandarle la cotización"}
              maxLength={tipo === "tarea" ? 255 : 500}
              className={inputClass}
            />
          </Campo>

          {tipo === "tarea" && (
            <Campo id="nuevo-descripcion" label="Descripción (opcional)">
              <textarea
                id="nuevo-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                maxLength={5000}
                className={cn(inputClass, "resize-y")}
              />
            </Campo>
          )}

          <Campo id="nuevo-fecha" label="Fecha y hora">
            <input
              id="nuevo-fecha"
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              className={inputClass}
            />
          </Campo>

          {error && <Aviso tipo="error">{error}</Aviso>}

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton variante="primario" onClick={guardar} loading={guardando}>
              Agendar
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
