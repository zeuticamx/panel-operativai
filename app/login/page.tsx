"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getAccessToken, mensajeDeError, setTokens } from "@/lib/auth";
import type { GoogleLoginIn, LoginIn, TokenOut } from "@/lib/types";
import { GOOGLE_CLIENT_ID } from "@/lib/google-identity";
import { AuthShell } from "@/app/components/auth-shell";
import { GoogleBoton } from "@/app/components/google-boton";
import { Aviso, Boton, Campo, inputClass } from "@/app/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) router.replace("/dashboard");
  }, [router]);

  const puedeEnviar = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar) return;

    setLoading(true);
    setError(null);
    try {
      const body: LoginIn = { email: email.trim().toLowerCase(), password };
      const tokens = await apiFetch<TokenOut>("/api/auth/login", {
        method: "POST",
        json: body,
        auth: false,
      });
      setTokens(tokens);
      router.replace("/dashboard");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo iniciar sesión."));
      setLoading(false);
    }
  };

  // El mismo botón sirve para entrar y para darse de alta: el backend
  // crea el negocio si el correo de la cuenta de Google es nuevo.
  const handleGoogle = async (credential: string) => {
    setLoading(true);
    setError(null);
    try {
      const body: GoogleLoginIn = { credential };
      const tokens = await apiFetch<TokenOut>("/api/auth/google", {
        method: "POST",
        json: body,
        auth: false,
      });
      setTokens(tokens);
      router.replace("/dashboard");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo continuar con Google."));
      setLoading(false);
    }
  };

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
