"use client";

import { useEffect, useState } from "react";
import type { TokenOut, UsuarioOut } from "./types";

/** uvicorn corre acá en HTTP plano; el proxy HTTPS de `dev:https`, acá. */
const PUERTO_BACKEND_HTTP = "8000";
const PUERTO_BACKEND_HTTPS = "8443";

/**
 * Si el portal se sirve por HTTPS (flujo `dev:https`, necesario para
 * FB.login()), llamar a un backend en HTTP plano es "mixed content":
 * el navegador intenta subir la petición a HTTPS por su cuenta, choca
 * contra un puerto que solo habla HTTP y la petición muere con
 * "No se pudo conectar con el servidor" (ver WARNING: Invalid HTTP
 * request received en el log del backend). `npm run dev:https` levanta
 * un local-ssl-proxy extra en :8443 -> :8000 con el mismo certificado
 * de mkcert; acá se detecta en tiempo de ejecución y se usa ese puerto
 * en vez de pisar NEXT_PUBLIC_API_URL con un valor fijo por entorno.
 */
function resolverApiUrl(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /\/$/,
    "",
  );
  if (typeof window === "undefined" || window.location.protocol !== "https:") {
    return base;
  }
  try {
    const url = new URL(base);
    if (url.port === PUERTO_BACKEND_HTTP) {
      // Da igual si en el .env quedó http:// o https://: el 8000 nunca
      // va a responder TLS. Desde una página HTTPS se pasa por el proxy.
      url.protocol = "https:";
      url.port = PUERTO_BACKEND_HTTPS;
    } else if (url.protocol === "http:") {
      url.protocol = "https:";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

export const API_URL = resolverApiUrl();

const ACCESS_KEY = "operativai_access_token";
const REFRESH_KEY = "operativai_refresh_token";
const AUTH_EVENT = "operativai-auth-change";

// ------------------------------------------------------------
// Tokens en localStorage
// ------------------------------------------------------------
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: Pick<TokenOut, "access_token" | "refresh_token">) {
  window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthChange(cb: () => void) {
  window.addEventListener(AUTH_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(AUTH_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// ------------------------------------------------------------
// Errores
// ------------------------------------------------------------
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * FastAPI devuelve `detail` como string en errores de negocio, y como
 * lista de objetos en errores de validación (422). Se normaliza a string.
 */
function extraerDetalle(data: unknown, status: number): string {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            const loc = Array.isArray((item as { loc?: unknown }).loc)
              ? ((item as { loc: unknown[] }).loc.filter((p) => p !== "body") as string[])
              : [];
            const campo = loc.length ? `${loc.join(".")}: ` : "";
            return campo + String((item as { msg: unknown }).msg);
          }
          return String(item);
        })
        .filter(Boolean);
      if (msgs.length) return msgs.join(" · ");
    }
  }
  if (status === 0) return "No se pudo conectar con el servidor";
  return `Error ${status}`;
}

export function mensajeDeError(e: unknown, fallback = "Ocurrió un error"): string {
  if (e instanceof ApiError) return e.detail;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

// ------------------------------------------------------------
// Refresh (deduplicado: si varias peticiones dan 401 a la vez, solo se
// llama a /auth/refresh una vez y todas esperan la misma promesa)
// ------------------------------------------------------------
let refreshEnCurso: Promise<boolean> | null = null;

async function refrescarTokens(): Promise<boolean> {
  if (refreshEnCurso) return refreshEnCurso;

  refreshEnCurso = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as TokenOut;
      setTokens(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshEnCurso = null;
    }
  })();

  return refreshEnCurso;
}

function irALogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

// ------------------------------------------------------------
// apiFetch
// ------------------------------------------------------------
export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Objeto serializable; se manda como JSON. */
  json?: unknown;
  body?: BodyInit | null;
  /** false para endpoints públicos (login, registro). Default true. */
  auth?: boolean;
}

/**
 * fetch contra el backend con Authorization automático y un reintento
 * tras refrescar el access_token si el primero da 401. Si el refresh
 * también falla, limpia tokens y manda a /login.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, auth = true, headers: extraHeaders, ...rest } = options;

  const construir = (): RequestInit => {
    const headers = new Headers(extraHeaders);
    if (json !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (auth) {
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    };
  };

  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, construir());
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor");
  }

  if (res.status === 401 && auth) {
    const ok = await refrescarTokens();
    if (!ok) {
      clearTokens();
      irALogin();
      throw new ApiError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    try {
      res = await fetch(url, construir());
    } catch {
      throw new ApiError(0, "No se pudo conectar con el servidor");
    }
    if (res.status === 401) {
      clearTokens();
      irALogin();
      throw new ApiError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    }
  }

  const texto = await res.text();
  let data: unknown = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = texto;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extraerDetalle(data, res.status));
  }

  return data as T;
}

// ------------------------------------------------------------
// Usuario actual
// ------------------------------------------------------------
export interface UsuarioActualState {
  usuario: UsuarioOut | null;
  loading: boolean;
  error: string | null;
}

/** Llama a GET /api/auth/yo al montar. */
export function useUsuarioActual(): UsuarioActualState {
  const [state, setState] = useState<UsuarioActualState>({
    usuario: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelado = false;
    apiFetch<UsuarioOut>("/api/auth/yo")
      .then((usuario) => {
        if (!cancelado) setState({ usuario, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelado)
          setState({ usuario: null, loading: false, error: mensajeDeError(e) });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return state;
}
