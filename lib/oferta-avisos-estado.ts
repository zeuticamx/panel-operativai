import { useSyncExternalStore } from "react";
import { CLAVE_OFERTA_AVISOS_MOSTRADA } from "./avisos-cita";

/**
 * Estado compartido mínimo (spec 007, RF-12): ¿está abierto el modal de oferta
 * de avisos de cita? El modal publica; el recorrido guiado solo lo lee, así
 * ninguno importa al otro. Es un store de módulo y no un contexto porque
 * RecorridoProvider vive fuera de UsuarioProvider y del layout privado.
 */
let abierto = false;
const oyentes = new Set<() => void>();

export function publicarOfertaAvisosAbierta(valor: boolean): void {
  if (abierto === valor) return;
  abierto = valor;
  oyentes.forEach((o) => o());
}

export function leerOfertaAvisosAbierta(): boolean {
  return abierto;
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Hook: ¿el modal de oferta de avisos está abierto ahora mismo? */
export function useOfertaAvisosAbierta(): boolean {
  return useSyncExternalStore(suscribir, leerOfertaAvisosAbierta, () => false);
}

/** ¿Ya se le mostró la oferta a este usuario en esta pestaña? (sessionStorage) */
export function ofertaAvisosYaMostrada(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_OFERTA_AVISOS_MOSTRADA) === "1";
  } catch {
    return false;
  }
}
