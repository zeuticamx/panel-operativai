"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { VendedorOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton, Campo } from "./ui";

/**
 * Dialog para editar nombre y teléfono de un vendedor.
 * Solo disponible para gerencia (no se valida acá, cae en 403 del servidor).
 */
export function EditarVendedor({
  vendedor,
  open,
  onOpenChange,
  onGuardado,
}: {
  vendedor: VendedorOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardado: (vendedor: VendedorOut) => void;
}) {
  const [nombre, setNombre] = useState(vendedor.nombre);
  const [telefono, setTelefono] = useState(vendedor.telefono ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambio =
    nombre !== vendedor.nombre || telefono !== (vendedor.telefono ?? "");
  const nombreValido = nombre.trim().length >= 2 && nombre.length <= 255;
  const telefonoValido = telefono.length === 0 || telefono.length <= 50;
  const puedeGuardar = cambio && nombreValido && telefonoValido && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await apiFetch<VendedorOut>(`/api/vendedores/${vendedor.id}`, {
        method: "PATCH",
        json: {
          nombre: nombre.trim(),
          telefono: telefono.trim() || null,
        },
      });
      onGuardado(r);
      onOpenChange(false);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudieron guardar los cambios."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="text-sm font-medium text-text-100">
                Editar vendedor
              </Dialog.Title>
              <Dialog.Description className="font-mono text-[11px] text-text-600">
                {vendedor.nombre}
              </Dialog.Description>
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

            <Campo
              id="editar-nombre"
              label="Nombre"
              hint="2-255 caracteres"
              error={nombre.trim() && !nombreValido ? "Mínimo 2, máximo 255 caracteres" : undefined}
            >
              <input
                id="editar-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={guardando}
                placeholder="Nombre del vendedor"
                className={cn(
                  "w-full rounded-md border border-bg-700 bg-bg-800 px-3 py-2 text-sm text-text-100",
                  "placeholder-text-600 transition-colors",
                  "focus:border-series-1 focus:outline-none focus:ring-1 focus:ring-series-1/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              />
            </Campo>

            <Campo
              id="editar-telefono"
              label="Teléfono"
              hint="Opcional, máximo 50 caracteres"
              error={telefono && !telefonoValido ? "Máximo 50 caracteres" : undefined}
            >
              <input
                id="editar-telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={guardando}
                placeholder="Teléfono (opcional)"
                className={cn(
                  "w-full rounded-md border border-bg-700 bg-bg-800 px-3 py-2 text-sm text-text-100",
                  "placeholder-text-600 transition-colors",
                  "focus:border-series-1 focus:outline-none focus:ring-1 focus:ring-series-1/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              />
            </Campo>
          </div>

          <footer className="flex justify-end gap-2 border-t border-bg-700 px-5 py-3">
            <Dialog.Close asChild>
              <Boton
                variante="secundario"
                disabled={guardando}
              >
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
