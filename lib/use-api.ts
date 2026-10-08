"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, mensajeDeError } from "./auth";

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Vuelve a pedir el recurso. `silencioso` no enciende `loading`. */
  recargar: (silencioso?: boolean) => Promise<void>;
}

interface Resultado<T> {
  /** Path al que corresponde `data`/`error`. */
  path: string | null;
  data: T | null;
  error: string | null;
}

export interface OpcionesRefresco {
  /** Vuelve a pedir cada tantos ms (solo con la pestaña visible). */
  refrescarCada?: number;
  /** Vuelve a pedir al volver a la pestaña/ventana. */
  alVolverAlFoco?: boolean;
}

/**
 * Refresco silencioso de red de seguridad: sondeo con la pestaña visible y
 * al recuperar el foco. Para páginas cuyos datos cambian por acciones de
 * otras personas (gerencia reprograma, reasigna, etc.).
 */
export function useRefrescoAutomatico(
  recargar: (silencioso?: boolean) => Promise<void>,
  refrescarCada?: number,
  alVolverAlFoco?: boolean,
): void {
  const recargarRef = useRef(recargar);
  useEffect(() => {
    recargarRef.current = recargar;
  }, [recargar]);

  useEffect(() => {
    if (!refrescarCada && !alVolverAlFoco) return;
    const visible = () => document.visibilityState === "visible";
    const refrescar = () => {
      if (visible()) void recargarRef.current(true);
    };
    const id = refrescarCada ? setInterval(refrescar, refrescarCada) : null;
    if (alVolverAlFoco) {
      document.addEventListener("visibilitychange", refrescar);
      window.addEventListener("focus", refrescar);
    }
    return () => {
      if (id !== null) clearInterval(id);
      document.removeEventListener("visibilitychange", refrescar);
      window.removeEventListener("focus", refrescar);
    };
  }, [refrescarCada, alVolverAlFoco]);
}

/**
 * GET simple con estado. Se vuelve a pedir cuando cambia `path`.
 * Ignora respuestas de peticiones viejas si `path` cambió en medio.
 * `data` conserva el valor anterior mientras llega el nuevo (útil para
 * atenuar una lista en vez de vaciarla al paginar).
 */
export function useApi<T>(path: string | null, opciones?: OpcionesRefresco): UseApiState<T> {
  const [resultado, setResultado] = useState<Resultado<T>>({
    path: null,
    data: null,
    error: null,
  });
  const [recargando, setRecargando] = useState(false);
  const version = useRef(0);

  const ejecutar = useCallback(async (p: string) => {
    const v = ++version.current;
    try {
      const res = await apiFetch<T>(p);
      if (v === version.current) setResultado({ path: p, data: res, error: null });
    } catch (e) {
      if (v === version.current) {
        setResultado((s) => ({ path: p, data: s.data, error: mensajeDeError(e) }));
      }
    } finally {
      if (v === version.current) setRecargando(false);
    }
  }, []);

  useEffect(() => {
    if (path === null) return;
    void ejecutar(path);
  }, [path, ejecutar]);

  const recargar = useCallback(
    async (silencioso = false) => {
      if (path === null) return;
      if (!silencioso) setRecargando(true);
      await ejecutar(path);
    },
    [path, ejecutar],
  );

  const refrescarCada = opciones?.refrescarCada;
  const alVolverAlFoco = opciones?.alVolverAlFoco;
  useRefrescoAutomatico(recargar, refrescarCada, alVolverAlFoco);

  const pendiente = path !== null && resultado.path !== path;

  return {
    data: resultado.data,
    loading: pendiente || recargando,
    error: pendiente ? null : resultado.error,
    recargar,
  };
}

/** Valor con retardo; útil para no disparar una búsqueda por cada tecla. */
export function useDebounce<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
