"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { ServicioActualizarIn, ServicioOut } from "@/lib/types";
import { Aviso, Boton, Campo, inputClass } from "./ui";

interface Errores {
  nombre?: string;
  duracion?: string;
  precio?: string;
}

/**
 * Modal de edición del catálogo (historia "editar servicio"). El padre solo
 * lo monta mientras hay un servicio en edición (mismo patrón que
 * ReservaForm/reprogramar): cerrarlo -- Cancelar, la X o clic afuera --
 * desmonta el componente entero, así que cualquier cambio sin guardar se
 * descarta solo, sin un "reset" explícito (escenario 6).
 *
 * Solo trae nombre/duración/precio: `activo` ya se maneja con el
 * interruptor de la fila en la tabla, duplicarlo acá confundiría cuál de
 * los dos manda.
 */
export function ServicioEditarModal({
  open,
  onOpenChange,
  servicio,
  tenantId,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  servicio: ServicioOut;
  tenantId: string;
  onGuardado: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState(servicio.nombre);
  const [duracion, setDuracion] = useState(String(servicio.duracion_minutos));
  const [precio, setPrecio] = useState(servicio.precio ?? "");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const validar = (): boolean => {
    const nuevos: Errores = {};

    if (!nombre.trim()) {
      nuevos.nombre = "El nombre es obligatorio.";
    }

    const dur = Number(duracion);
    if (duracion.trim() === "" || !Number.isFinite(dur) || dur <= 0) {
      nuevos.duracion = "La duración debe ser mayor a 0 minutos.";
    } else if (dur < 5) {
      nuevos.duracion = "La duración mínima es de 5 minutos.";
    } else if (dur > 480) {
      nuevos.duracion = "La duración máxima es de 480 minutos.";
    }

    if (precio.trim() !== "") {
      const p = Number(precio);
      if (!Number.isFinite(p)) {
        nuevos.precio = "Precio inválido.";
      } else if (p < 0) {
        nuevos.precio = "El precio no puede ser negativo.";
      }
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const guardar = async () => {
    setError(null);
    if (!validar()) return;

    setGuardando(true);
    try {
      await apiFetch<ServicioOut>(
        `/api/tenants/${tenantId}/calendario/servicios/${servicio.id}`,
        {
          method: "PATCH",
          json: {
            nombre: nombre.trim(),
            duracion_minutos: Number(duracion),
            precio: precio.trim() === "" ? null : precio.trim(),
          } satisfies ServicioActualizarIn,
        },
      );
      onGuardado("Servicio actualizado con éxito.");
      onOpenChange(false);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo actualizar el servicio."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <Dialog.Title className="text-sm font-medium text-text-100">Editar servicio</Dialog.Title>

          <div className="mt-4 flex flex-col gap-3">
            <Campo id="se-nombre" label="Nombre" error={errores.nombre}>
              <input
                id="se-nombre"
                className={inputClass}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Corte de cabello"
              />
            </Campo>
            <Campo id="se-duracion" label="Duración (min)" error={errores.duracion}>
              <input
                id="se-duracion"
                type="number"
                min={1}
                max={480}
                className={inputClass}
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
              />
            </Campo>
            <Campo id="se-precio" label="Precio" hint="opcional" error={errores.precio}>
              <input
                id="se-precio"
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.00"
              />
            </Campo>

            {error && <Aviso tipo="error">{error}</Aviso>}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton variante="primario" loading={guardando} onClick={guardar}>
              Guardar cambios
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
