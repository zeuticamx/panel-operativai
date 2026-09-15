"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { PipelineOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton, Campo, inputClass, selectClass } from "./ui";

/**
 * Dialog para crear un cliente manualmente en el embudo. Se asigna
 * automáticamente según la estrategia configurada del tenant.
 */
export function CrearClienteForm({
  tenantId,
  open,
  onOpenChange,
  onCreado,
}: {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama después de crear un cliente exitosamente. */
  onCreado: (cliente: PipelineOut, mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [handle, setHandle] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [montoEstimado, setMontoEstimado] = useState("");
  const [nota, setNota] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resetear el form al abrir/cerrar el dialog es el patrón correcto.
    setNombre("");
    setHandle("");
    setCanal("whatsapp");
    setMontoEstimado("");
    setNota("");
    setError(null);
  }, [open]);

  const nombreValido = nombre.trim().length > 0;
  const montoValido =
    montoEstimado.trim() === "" ||
    (!Number.isNaN(Number(montoEstimado)) && Number(montoEstimado) >= 0);
  const puedeGuardar = nombreValido && montoValido && !creando;

  const crear = async () => {
    if (!puedeGuardar) return;
    setCreando(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        tenant_id: tenantId,
        nombre: nombre.trim(),
        canal,
      };
      if (handle.trim()) body.handle = handle.trim();
      if (montoEstimado.trim()) body.monto_estimado = Number(montoEstimado);
      if (nota.trim()) body.nota = nota.trim();

      const cliente = await apiFetch<PipelineOut>("/api/clientes", {
        method: "POST",
        json: body,
      });
      onCreado(cliente, `${nombre.trim()} creado y asignado al embudo.`);
      onOpenChange(false);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo crear el cliente."));
    } finally {
      setCreando(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!creando) onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="text-sm font-medium text-text-100">
                Crear cliente
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-text-600">
                Nuevo cliente en el embudo
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Boton
                variante="fantasma"
                disabled={creando}
                aria-label="Cerrar"
                className="min-h-8 shrink-0 px-2"
              >
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>

          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            <Campo
              id="cliente-nombre"
              label="Nombre del cliente"
              hint="Obligatorio"
              error={nombre.trim() === "" && nombre.length > 0 ? "Escribe un nombre" : undefined}
            >
              <input
                id="cliente-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={creando}
                placeholder="Ej: Ferretería García"
                className={inputClass}
              />
            </Campo>

            <Campo
              id="cliente-handle"
              label="Handle (WhatsApp, Instagram, etc.)"
              hint="Opcional"
            >
              <input
                id="cliente-handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={creando}
                placeholder="Ej: +521234567890 o @usuario"
                className={inputClass}
              />
            </Campo>

            <Campo id="cliente-canal" label="Canal de origen">
              <select
                id="cliente-canal"
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                disabled={creando}
                className={selectClass}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>

            <Campo
              id="cliente-monto"
              label="Monto estimado"
              hint="Opcional"
              error={
                montoEstimado.trim() && !montoValido ? "Debe ser un número válido" : undefined
              }
            >
              <input
                id="cliente-monto"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={montoEstimado}
                onChange={(e) => setMontoEstimado(e.target.value)}
                disabled={creando}
                placeholder="0.00"
                className={inputClass}
              />
            </Campo>

            <Campo id="cliente-nota" label="Nota inicial" hint="Opcional, queda en la bitácora">
              <textarea
                id="cliente-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                disabled={creando}
                rows={2}
                maxLength={1000}
                placeholder="Contexto del contacto…"
                className={cn(inputClass, "resize-y")}
              />
            </Campo>
          </div>

          <footer className="flex justify-end gap-2 border-t border-bg-700 px-5 py-3">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={creando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton
              variante="primario"
              onClick={crear}
              loading={creando}
              disabled={!puedeGuardar}
            >
              Crear
            </Boton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
