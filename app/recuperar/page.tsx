"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getAccessToken, mensajeDeError } from "@/lib/auth";
import type {
  RecuperacionSolicitadaOut,
  RestablecerPasswordIn,
  SolicitarRecuperacionIn,
} from "@/lib/types";
import { AuthShell } from "@/app/components/auth-shell";
import { Aviso, Boton, Campo, inputClass } from "@/app/components/ui";

const PASSWORD_MIN = 8;
const CODIGO_LARGO = 6;

/**
 * Recuperación de contraseña en dos pasos: el correo, y después el código
 * de 6 dígitos junto con la contraseña nueva.
 *
 * El backend responde igual exista o no la cuenta (anti-enumeración), así
 * que el paso 1 siempre avanza con un "si el correo está registrado...". Y
 * en el paso 2 solo dice "incorrecto o venció": distinguir "venció" lo
 * resuelve esta pantalla con su propia cuenta regresiva desde que se pidió
 * el código.
 */
type Paso = "correo" | "codigo" | "listo";

function formatoReloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RecuperarPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("correo");

  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [tocado, setTocado] = useState(false);

  // Las dos cuentas regresivas del paso 2: cuánto le queda al código y
  // cuánto falta para poder pedir otro.
  const [segundosVigencia, setSegundosVigencia] = useState(0);
  const [segundosReenvio, setSegundosReenvio] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) router.replace("/dashboard");
  }, [router]);

  // Un solo tic por segundo para las dos cuentas regresivas; se apaga solo
  // cuando ambas llegan a cero.
  const enCurso = paso === "codigo" && (segundosVigencia > 0 || segundosReenvio > 0);
  useEffect(() => {
    if (!enCurso) return;
    const t = setTimeout(() => {
      setSegundosVigencia((s) => Math.max(0, s - 1));
      setSegundosReenvio((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [enCurso, segundosVigencia, segundosReenvio]);

  const emailNormalizado = email.trim().toLowerCase();
  const vencido = paso === "codigo" && segundosVigencia === 0;

  const errorPassword =
    tocado && password.length > 0 && password.length < PASSWORD_MIN
      ? `Mínimo ${PASSWORD_MIN} caracteres`
      : null;
  const errorConfirmacion =
    tocado && confirmacion.length > 0 && confirmacion !== password
      ? "Las contraseñas no coinciden"
      : null;

  const puedeRestablecer =
    !vencido &&
    codigo.length === CODIGO_LARGO &&
    password.length >= PASSWORD_MIN &&
    confirmacion === password;

  // ------------------------------------------------------------
  // Paso 1 (y reenvío): pedir un código
  // ------------------------------------------------------------
  const pedirCodigo = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const body: SolicitarRecuperacionIn = { email: emailNormalizado };
      const r = await apiFetch<RecuperacionSolicitadaOut>("/api/auth/recuperar/solicitar", {
        method: "POST",
        json: body,
        auth: false,
      });
      setCodigo("");
      setSegundosVigencia(r.expira_en_minutos * 60);
      setSegundosReenvio(r.reenviar_en_segundos);
      return true;
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo solicitar el código."));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleCorreo = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailNormalizado || loading) return;
    if (await pedirCodigo()) setPaso("codigo");
  };

  const reenviar = async () => {
    if (await pedirCodigo()) {
      setAviso("Si el correo está registrado, te enviamos un código nuevo. El anterior ya no sirve.");
    }
  };

  // ------------------------------------------------------------
  // Paso 2: código + contraseña nueva
  // ------------------------------------------------------------
  const handleRestablecer = async (e: FormEvent) => {
    e.preventDefault();
    setTocado(true);
    if (!puedeRestablecer || loading) return;

    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const body: RestablecerPasswordIn = { email: emailNormalizado, codigo, password };
      await apiFetch<void>("/api/auth/recuperar/restablecer", {
        method: "POST",
        json: body,
        auth: false,
      });
      setPassword("");
      setConfirmacion("");
      setPaso("listo");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo restablecer la contraseña."));
      setCodigo("");
    } finally {
      setLoading(false);
    }
  };

  const volverACorreo = () => {
    setPaso("correo");
    setCodigo("");
    setPassword("");
    setConfirmacion("");
    setTocado(false);
    setError(null);
    setAviso(null);
  };

  // ------------------------------------------------------------
  // Listo
  // ------------------------------------------------------------
  if (paso === "listo") {
    return (
      <AuthShell titulo="Contraseña actualizada" sub="Ya puedes entrar con tu contraseña nueva">
        <div className="mt-8 flex flex-col gap-4">
          <Aviso tipo="exito">
            Por seguridad cerramos las sesiones que tenías abiertas en otros dispositivos.
          </Aviso>
          <Boton variante="primario" onClick={() => router.replace("/login")} className="py-2 text-sm">
            Iniciar sesión
          </Boton>
        </div>
      </AuthShell>
    );
  }

  // ------------------------------------------------------------
  // Paso 2 — código y contraseña nueva
  // ------------------------------------------------------------
  if (paso === "codigo") {
    return (
      <AuthShell
        titulo="Restablece tu contraseña"
        sub={`Si ${emailNormalizado} está registrado, te enviamos un código de ${CODIGO_LARGO} dígitos.`}
        pie={
          <button
            type="button"
            onClick={volverACorreo}
            className="cursor-pointer font-medium text-text-100 underline-offset-2 hover:underline"
          >
            Usar otro correo
          </button>
        }
      >
        <form onSubmit={handleRestablecer} className="mt-8 flex flex-col gap-4" noValidate>
          <Campo
            id="codigo"
            label="Código"
            hint={vencido ? undefined : `Vence en ${formatoReloj(segundosVigencia)}`}
          >
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={codigo}
              // Solo dígitos: pegar "123 456" o "123-456" funciona igual.
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, CODIGO_LARGO))}
              disabled={loading || vencido}
              placeholder="000000"
              maxLength={CODIGO_LARGO}
              required
              className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
            />
          </Campo>

          <Campo
            id="password"
            label="Contraseña nueva"
            hint={`Mínimo ${PASSWORD_MIN} caracteres`}
            error={errorPassword}
          >
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTocado(true)}
              autoComplete="new-password"
              disabled={loading || vencido}
              placeholder="••••••••"
              minLength={PASSWORD_MIN}
              maxLength={128}
              required
              className={inputClass}
            />
          </Campo>

          <Campo id="confirmacion" label="Confirma la contraseña nueva" error={errorConfirmacion}>
            <input
              id="confirmacion"
              type="password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              onBlur={() => setTocado(true)}
              autoComplete="new-password"
              disabled={loading || vencido}
              placeholder="••••••••"
              maxLength={128}
              required
              className={inputClass}
            />
          </Campo>

          {vencido && (
            <Aviso tipo="error">El código venció. Solicita uno nuevo para continuar.</Aviso>
          )}
          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
          {error && <Aviso tipo="error">{error}</Aviso>}

          <Boton
            type="submit"
            variante="primario"
            loading={loading}
            disabled={!puedeRestablecer}
            className="mt-2 py-2 text-sm"
          >
            {loading ? "Guardando…" : "Cambiar contraseña"}
          </Boton>

          <Boton
            variante={vencido ? "secundario" : "fantasma"}
            onClick={reenviar}
            disabled={loading || segundosReenvio > 0}
            className="text-xs"
          >
            {segundosReenvio > 0
              ? `Solicitar nuevo código en ${segundosReenvio}s`
              : "Solicitar nuevo código"}
          </Boton>

          <p className="text-center font-mono text-[11px] text-text-600">
            Revisa la carpeta de spam si no lo ves.
          </p>
        </form>
      </AuthShell>
    );
  }

  // ------------------------------------------------------------
  // Paso 1 — correo
  // ------------------------------------------------------------
  return (
    <AuthShell
      titulo="¿Olvidaste tu contraseña?"
      sub="Te enviaremos un código para crear una nueva"
      pie={
        <>
          ¿La recordaste?{" "}
          <Link href="/login" className="font-medium text-text-100 underline-offset-2 hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleCorreo} className="mt-8 flex flex-col gap-4" noValidate>
        <Campo id="email" label="Correo de tu cuenta">
          <input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            disabled={loading}
            placeholder="tu@negocio.com"
            required
            className={inputClass}
          />
        </Campo>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton
          type="submit"
          variante="primario"
          loading={loading}
          disabled={!emailNormalizado}
          className="mt-2 py-2 text-sm"
        >
          {loading ? "Enviando código…" : "Enviar código"}
        </Boton>
      </form>
    </AuthShell>
  );
}
