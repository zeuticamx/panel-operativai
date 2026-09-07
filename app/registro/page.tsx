"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getAccessToken, mensajeDeError, setTokens } from "@/lib/auth";
import type {
  RegistroIn,
  TokenOut,
  VerificacionPendienteOut,
  VerificarCodigoIn,
} from "@/lib/types";
import { AuthShell } from "@/app/components/auth-shell";
import { Aviso, Boton, Campo, inputClass } from "@/app/components/ui";

const PASSWORD_MIN = 8;
const NEGOCIO_MIN = 2;
const CODIGO_LARGO = 6;

/**
 * El alta va en dos pasos: primero los datos, después el código de 6
 * dígitos que el backend manda por correo. La cuenta no existe hasta que
 * el código se verifica, así que si el usuario abandona acá no queda nada
 * a medias del lado del servidor.
 */
type Paso = "datos" | "codigo";

export default function RegistroPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("datos");

  const [nombreNegocio, setNombreNegocio] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tocado, setTocado] = useState<{ password?: boolean; negocio?: boolean }>({});

  const [codigo, setCodigo] = useState("");
  const [segundosReenvio, setSegundosReenvio] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) router.replace("/dashboard");
  }, [router]);

  // Cuenta regresiva del botón de reenviar. Un setTimeout por segundo en
  // vez de un intervalo: se cancela solo al llegar a cero.
  useEffect(() => {
    if (segundosReenvio <= 0) return;
    const t = setTimeout(() => setSegundosReenvio((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundosReenvio]);

  const errorPassword =
    tocado.password && password.length > 0 && password.length < PASSWORD_MIN
      ? `Mínimo ${PASSWORD_MIN} caracteres`
      : null;
  const errorNegocio =
    tocado.negocio && nombreNegocio.trim().length > 0 && nombreNegocio.trim().length < NEGOCIO_MIN
      ? `Mínimo ${NEGOCIO_MIN} caracteres`
      : null;

  const puedeEnviar =
    nombreNegocio.trim().length >= NEGOCIO_MIN &&
    email.trim().length > 0 &&
    password.length >= PASSWORD_MIN;

  const emailNormalizado = email.trim().toLowerCase();

  // ------------------------------------------------------------
  // Paso 1: datos → el backend manda el código
  // ------------------------------------------------------------
  const handleDatos = async (e: FormEvent) => {
    e.preventDefault();
    setTocado({ password: true, negocio: true });
    if (!puedeEnviar) return;

    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const body: RegistroIn = {
        email: emailNormalizado,
        password,
        full_name: fullName.trim() || null,
        nombre_negocio: nombreNegocio.trim(),
      };
      const pendiente = await apiFetch<VerificacionPendienteOut>(
        "/api/auth/registro",
        { method: "POST", json: body, auth: false },
      );
      setPaso("codigo");
      setCodigo("");
      setSegundosReenvio(pendiente.reenviar_en_segundos);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo enviar el código."));
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Paso 2: código → se crea la cuenta y llegan los tokens
  // ------------------------------------------------------------
  const verificar = async (valor: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const body: VerificarCodigoIn = { email: emailNormalizado, codigo: valor };
      const tokens = await apiFetch<TokenOut>("/api/auth/verificar", {
        method: "POST",
        json: body,
        auth: false,
      });
      setTokens(tokens);
      // Sin apagar `loading`: la navegación desmonta la página igual.
      router.replace("/dashboard");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo verificar el código."));
      setCodigo("");
      setLoading(false);
    }
  };

  const handleCodigo = (e: FormEvent) => {
    e.preventDefault();
    if (codigo.length === CODIGO_LARGO) verificar(codigo);
  };

  const handleCambioCodigo = (valor: string) => {
    // Solo dígitos: pegar "123 456" o "123-456" tiene que funcionar igual.
    const limpio = valor.replace(/\D/g, "").slice(0, CODIGO_LARGO);
    setCodigo(limpio);
    // Al completar los 6 dígitos se envía solo. Nadie quiere teclear el
    // código y encima buscar el botón.
    if (limpio.length === CODIGO_LARGO) verificar(limpio);
  };

  const reenviar = async () => {
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const pendiente = await apiFetch<VerificacionPendienteOut>(
        "/api/auth/reenviar-codigo",
        { method: "POST", json: { email: emailNormalizado }, auth: false },
      );
      setCodigo("");
      setSegundosReenvio(pendiente.reenviar_en_segundos);
      setAviso("Te enviamos un código nuevo. El anterior ya no sirve.");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo reenviar el código."));
    } finally {
      setLoading(false);
    }
  };

  const volverADatos = () => {
    setPaso("datos");
    setCodigo("");
    setError(null);
    setAviso(null);
  };

  // ------------------------------------------------------------
  // Paso 2 — pantalla del código
  // ------------------------------------------------------------
  if (paso === "codigo") {
    return (
      <AuthShell
        titulo="Verifica tu correo"
        sub={`Enviamos un código de ${CODIGO_LARGO} dígitos a ${emailNormalizado}`}
        pie={
          <button
            type="button"
            onClick={volverADatos}
            className="cursor-pointer font-medium text-text-100 underline-offset-2 hover:underline"
          >
            Usar otro correo
          </button>
        }
      >
        <form onSubmit={handleCodigo} className="mt-8 flex flex-col gap-4" noValidate>
          <Campo id="codigo" label="Código de verificación">
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              // Deja que iOS y Android ofrezcan el código del SMS/correo
              // directo desde el teclado.
              autoComplete="one-time-code"
              autoFocus
              value={codigo}
              onChange={(e) => handleCambioCodigo(e.target.value)}
              disabled={loading}
              placeholder="000000"
              maxLength={CODIGO_LARGO}
              required
              className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
            />
          </Campo>

          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
          {error && <Aviso tipo="error">{error}</Aviso>}

          <Boton
            type="submit"
            variante="primario"
            loading={loading}
            disabled={codigo.length !== CODIGO_LARGO}
            className="mt-2 py-2 text-sm"
          >
            {loading ? "Verificando…" : "Crear cuenta"}
          </Boton>

          <Boton
            variante="fantasma"
            onClick={reenviar}
            disabled={loading || segundosReenvio > 0}
            className="text-xs"
          >
            {segundosReenvio > 0
              ? `Reenviar código en ${segundosReenvio}s`
              : "Reenviar código"}
          </Boton>

          <p className="text-center font-mono text-[11px] text-text-600">
            Revisa la carpeta de spam si no lo ves.
          </p>
        </form>
      </AuthShell>
    );
  }

  // ------------------------------------------------------------
  // Paso 1 — datos del negocio
  // ------------------------------------------------------------
  return (
    <AuthShell
      titulo="Crear cuenta"
      sub="Da de alta tu negocio y su agente de IA"
      pie={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-text-100 underline-offset-2 hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleDatos} className="mt-8 flex flex-col gap-4" noValidate>
        <Campo id="nombre_negocio" label="Nombre del negocio" error={errorNegocio}>
          <input
            id="nombre_negocio"
            type="text"
            value={nombreNegocio}
            onChange={(e) => setNombreNegocio(e.target.value)}
            onBlur={() => setTocado((t) => ({ ...t, negocio: true }))}
            autoComplete="organization"
            disabled={loading}
            placeholder="Ferretería El Tornillo"
            maxLength={255}
            required
            className={inputClass}
          />
        </Campo>

        <Campo id="full_name" label="Tu nombre" hint="opcional">
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={loading}
            placeholder="Nombre y apellido"
            className={inputClass}
          />
        </Campo>

        <Campo id="email" label="Correo" hint="Te mandamos un código para confirmarlo">
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

        <Campo
          id="password"
          label="Contraseña"
          hint={`Mínimo ${PASSWORD_MIN} caracteres`}
          error={errorPassword}
        >
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTocado((t) => ({ ...t, password: true }))}
            autoComplete="new-password"
            disabled={loading}
            placeholder="••••••••"
            minLength={PASSWORD_MIN}
            maxLength={128}
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
          {loading ? "Enviando código…" : "Continuar"}
        </Boton>
      </form>
    </AuthShell>
  );
}
