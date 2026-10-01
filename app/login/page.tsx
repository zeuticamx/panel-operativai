"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, getAccessToken, mensajeDeError, setTokens } from "@/lib/auth";
import type { GoogleLoginIn, LoginIn, TokenOut } from "@/lib/types";
import { GOOGLE_CLIENT_ID } from "@/lib/google-identity";
import { AceptarTerminos } from "@/app/components/aceptar-terminos";
import { AuthShell } from "@/app/components/auth-shell";
import { GoogleBoton } from "@/app/components/google-boton";
import { Aviso, Boton, Campo, inputClass } from "@/app/components/ui";

/**
 * Lo que quedó esperando la aceptación de los términos. El backend
 * responde 428 cuando (a) el correo de Google es nuevo — no crea la cuenta
 * hasta que se acepte — o (b) la cuenta es anterior a los términos y tiene
 * que aceptarlos en este ingreso. En los dos casos se reenvía la misma
 * petición con `acepta_terminos: true`.
 *
 * Vive solo en memoria: la contraseña o el credential de Google no se
 * guardan en ningún otro lado.
 */
type Pendiente = { via: "password" } | { via: "google"; credential: string };

function pideTerminos(e: unknown): boolean {
  return e instanceof ApiError && e.status === 428;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  useEffect(() => {
    if (getAccessToken()) router.replace("/dashboard");
  }, [router]);

  const puedeEnviar = email.trim().length > 0 && password.length > 0;

  const entrarConPassword = async (acepta: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const body: LoginIn = {
        email: email.trim().toLowerCase(),
        password,
        ...(acepta ? { acepta_terminos: true } : {}),
      };
      const tokens = await apiFetch<TokenOut>("/api/auth/login", {
        method: "POST",
        json: body,
        auth: false,
      });
      setTokens(tokens);
      router.replace("/dashboard");
    } catch (err) {
      if (pideTerminos(err)) {
        setAceptaTerminos(false);
        setPendiente({ via: "password" });
        setLoading(false);
        return;
      }
      setError(mensajeDeError(err, "No se pudo iniciar sesión."));
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar) return;
    await entrarConPassword(false);
  };

  // El mismo botón sirve para entrar y para darse de alta. Si el correo de
  // la cuenta de Google es nuevo, el backend NO la crea todavía: responde
  // 428 y acá se pide aceptar los términos antes de reenviar el credential.
  const entrarConGoogle = async (credential: string, acepta: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const body: GoogleLoginIn = { credential, ...(acepta ? { acepta_terminos: true } : {}) };
      const tokens = await apiFetch<TokenOut>("/api/auth/google", {
        method: "POST",
        json: body,
        auth: false,
      });
      setTokens(tokens);
      router.replace("/dashboard");
    } catch (err) {
      if (pideTerminos(err)) {
        setAceptaTerminos(false);
        setPendiente({ via: "google", credential });
        setLoading(false);
        return;
      }
      // El ID token de Google dura pocos minutos: si se tardó en aceptar,
      // hay que volver a pulsar el botón, y el mensaje genérico no lo dice.
      if (acepta && err instanceof ApiError && err.status === 401) {
        setPendiente(null);
        setError("La sesión de Google venció. Vuelve a pulsar «Continuar con Google».");
        setLoading(false);
        return;
      }
      setError(mensajeDeError(err, "No se pudo continuar con Google."));
      setLoading(false);
    }
  };

  const handleGoogle = (credential: string) => entrarConGoogle(credential, false);

  const confirmarTerminos = () => {
    if (!pendiente || !aceptaTerminos || loading) return;
    if (pendiente.via === "google") entrarConGoogle(pendiente.credential, true);
    else entrarConPassword(true);
  };

  const cancelarTerminos = () => {
    setPendiente(null);
    setAceptaTerminos(false);
    setError(null);
  };

  // ------------------------------------------------------------
  // Paso intermedio: aceptar los términos antes de continuar
  // ------------------------------------------------------------
  if (pendiente) {
    return (
      <AuthShell
        titulo="Antes de continuar"
        sub="Necesitamos que aceptes los términos para usar tu cuenta"
        pie={
          <button
            type="button"
            onClick={cancelarTerminos}
            disabled={loading}
            className="cursor-pointer font-medium text-text-100 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Cancelar
          </button>
        }
      >
        <div className="mt-8 flex flex-col gap-4">
          <AceptarTerminos checked={aceptaTerminos} onChange={setAceptaTerminos} disabled={loading} />

          {error && <Aviso tipo="error">{error}</Aviso>}

          <Boton
            variante="primario"
            onClick={confirmarTerminos}
            loading={loading}
            disabled={!aceptaTerminos}
            className="mt-2 py-2 text-sm"
          >
            {loading ? "Continuando…" : "Aceptar y continuar"}
          </Boton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Iniciar sesión"
      sub="Entra al panel de tu agente de IA"
      pie={
        <>
          ¿Todavía no tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-text-100 underline-offset-2 hover:underline">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <Campo id="email" label="Correo">
          <input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
            placeholder="tu@negocio.com"
            required
            className={inputClass}
          />
        </Campo>

        <Campo id="password" label="Contraseña">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            placeholder="••••••••"
            required
            className={inputClass}
          />
        </Campo>

        <Link
          href="/recuperar"
          className="-mt-2 self-end text-xs text-text-400 underline-offset-2 hover:text-text-100 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton
          type="submit"
          variante="primario"
          loading={loading}
          disabled={!puedeEnviar}
          className="mt-2 py-2 text-sm"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </Boton>
      </form>

      {GOOGLE_CLIENT_ID && (
        <>
          <div className="mt-6 flex items-center gap-3 text-[11px] text-text-600">
            <span className="h-px flex-1 bg-bg-700" />
            o
            <span className="h-px flex-1 bg-bg-700" />
          </div>
          <GoogleBoton onCredential={handleGoogle} disabled={loading} className="mt-4" />
        </>
      )}
    </AuthShell>
  );
}
