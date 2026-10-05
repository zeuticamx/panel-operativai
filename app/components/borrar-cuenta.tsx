"use client";

import { useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { apiFetch, clearTokens, mensajeDeError } from "@/lib/auth";
import { fmtInt, formatoFechaHora, formatoMonto } from "@/lib/formato";
import type { EliminacionCuentaOut, EliminarCuentaIn } from "@/lib/types";
import { GoogleBoton } from "@/app/components/google-boton";
import { Aviso, Boton, Campo, inputClass } from "@/app/components/ui";

export const PALABRA_CONFIRMACION = "ELIMINAR";

/**
 * "Borrar cuenta" del dueño (backend/routers/cuenta.py). Borra el negocio
 * entero y no se puede deshacer, así que hay tres barreras:
 *
 *   1. Antes de abrir nada se pide la revisión: si hay una suscripción que
 *      todavía cobra o pagos pendientes, se explica y no se deja seguir.
 *   2. Un primer paso con la advertencia de lo que se pierde (incluidos los
 *      días pagados de una suscripción ya cancelada).
 *   3. Un segundo paso que exige escribir ELIMINAR y la contraseña actual
 *      (o volver a entrar con Google en cuentas sin contraseña).
 *
 * El backend vuelve a validar todo; esto es para que nadie llegue al final
 * por accidente.
 */
export function BorrarCuenta() {
  const [abierto, setAbierto] = useState(false);
  const [revision, setRevision] = useState<EliminacionCuentaOut | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [paso, setPaso] = useState<"advertencia" | "confirmar">("advertencia");
  const [confirmacion, setConfirmacion] = useState("");
  const [password, setPassword] = useState("");
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reiniciar = () => {
    setPaso("advertencia");
    setConfirmacion("");
    setPassword("");
    setGoogleCredential(null);
    setError(null);
  };

  const abrir = async () => {
    setRevisando(true);
    setError(null);
    reiniciar();
    try {
      setRevision(await apiFetch<EliminacionCuentaOut>("/api/cuenta/eliminacion"));
      setAbierto(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo revisar la cuenta."));
    } finally {
      setRevisando(false);
    }
  };

  const cambiarAbierto = (v: boolean) => {
    if (enviando) return;
    setAbierto(v);
    if (!v) reiniciar();
  };

  const conGoogle = revision?.verificacion === "google";
  const credencialLista = conGoogle ? Boolean(googleCredential) : password.length > 0;
  const listo = confirmacion === PALABRA_CONFIRMACION && credencialLista;

  const eliminar = async (e: FormEvent) => {
    e.preventDefault();
    if (!listo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const cuerpo: EliminarCuentaIn = {
        confirmacion,
        password: conGoogle ? null : password,
        google_credential: conGoogle ? googleCredential : null,
      };
      await apiFetch<void>("/api/cuenta/eliminar", { method: "POST", json: cuerpo });
      // La cuenta ya no existe: cualquier token que quede daría 401. Se
      // limpia la sesión y se sale sin esperar a que eso pase.
      clearTokens();
      window.location.replace("/login");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo borrar la cuenta."));
      // Una credencial de Google es de un solo intento: se pide otra.
      setGoogleCredential(null);
      setEnviando(false);
    }
  };

  const bloqueos = revision?.bloqueos ?? [];
  const creditos = Number(revision?.creditos_disponibles ?? 0);

  return (
    <section
      aria-labelledby="borrar-cuenta"
      className="flex flex-col gap-3 rounded-md border border-danger/40 p-4"
    >
      <header>
        <h2 id="borrar-cuenta" className="text-sm font-medium text-text-100">
          Borrar cuenta
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-text-400">
          Borra tu negocio y todo lo suyo: tu equipo, conversaciones, CRM, calendario e historial.{" "}
          <strong className="text-text-100">No se puede deshacer.</strong> Antes tienes que cancelar
          tu suscripción y no tener pagos pendientes.
        </p>
      </header>

      {error && !abierto && <Aviso tipo="error">{error}</Aviso>}

      <div>
        <Boton variante="peligro" onClick={() => void abrir()} loading={revisando}>
          <Trash2 size={13} aria-hidden />
          Borrar cuenta
        </Boton>
      </div>

      <Dialog.Root open={abierto} onOpenChange={cambiarAbierto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
            {bloqueos.length > 0 ? (
              <>
                <Dialog.Title className="text-sm font-medium text-text-100">
                  Todavía no puedes borrar tu cuenta
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-xs text-text-400">
                  Resuelve esto primero:
                </Dialog.Description>
                <ul className="mt-3 flex flex-col gap-2" aria-label="Por qué no se puede borrar">
                  {bloqueos.map((b) => (
                    <li key={b.codigo}>
                      <Aviso tipo="error">{b.mensaje}</Aviso>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex justify-end">
                  <Dialog.Close asChild>
                    <Boton variante="secundario">Entendido</Boton>
                  </Dialog.Close>
                </div>
              </>
            ) : paso === "advertencia" ? (
              <>
                <Dialog.Title className="text-sm font-medium text-text-100">
                  ¿Borrar tu cuenta para siempre?
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-text-400">
                  Esta acción es irreversible. Se borran para siempre:
                </Dialog.Description>
                <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-5 text-xs text-text-400">
                  <li>
                    {fmtInt.format(revision?.usuarios_portal ?? 0)} usuarios del portal (tu equipo
                    pierde el acceso)
                  </li>
                  <li>{fmtInt.format(revision?.conversaciones ?? 0)} conversaciones</li>
                  <li>tu configuración, CRM, calendario e historial de cobros</li>
                </ul>
                {revision?.pagado_hasta && (
                  <div className="mt-3">
                    <Aviso tipo="error">
                      Tu plan está pagado hasta el{" "}
                      <strong>{formatoFechaHora(revision.pagado_hasta)}</strong>. Si borras la
                      cuenta ahora, esos días se pierden y no se reembolsan. Te recomendamos
                      esperar a esa fecha.
                    </Aviso>
                  </div>
                )}
                {creditos > 0 && (
                  <div className="mt-3">
                    <Aviso tipo="info">
                      También pierdes <strong>{formatoMonto(revision?.creditos_disponibles ?? "0")}</strong>{" "}
                      créditos sin usar.
                    </Aviso>
                  </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Boton variante="secundario">Cancelar</Boton>
                  </Dialog.Close>
                  <Boton variante="peligro" onClick={() => setPaso("confirmar")}>
                    Entiendo, continuar
                  </Boton>
                </div>
              </>
            ) : (
              <form onSubmit={eliminar}>
                <Dialog.Title className="text-sm font-medium text-text-100">
                  Confirma que quieres borrar tu cuenta
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-text-400">
                  Escribe <strong className="font-mono text-text-100">{PALABRA_CONFIRMACION}</strong>{" "}
                  y {conGoogle ? "vuelve a entrar con Google" : "tu contraseña actual"}.
                </Dialog.Description>

                <div className="mt-4 flex flex-col gap-3">
                  <Campo id="borrar-confirmacion" label={`Escribe ${PALABRA_CONFIRMACION}`}>
                    <input
                      id="borrar-confirmacion"
                      value={confirmacion}
                      onChange={(e) => setConfirmacion(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={enviando}
                      className={inputClass}
                    />
                  </Campo>

                  {conGoogle ? (
                    googleCredential ? (
                      <Aviso tipo="exito">Identidad confirmada con Google.</Aviso>
                    ) : (
                      <GoogleBoton onCredential={setGoogleCredential} disabled={enviando} />
                    )
                  ) : (
                    <Campo id="borrar-password" label="Contraseña actual">
                      <input
                        id="borrar-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={enviando}
                        className={inputClass}
                      />
                    </Campo>
                  )}

                  {error && <Aviso tipo="error">{error}</Aviso>}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Boton variante="secundario" disabled={enviando}>
                      Cancelar
                    </Boton>
                  </Dialog.Close>
                  <Boton type="submit" variante="peligro" loading={enviando} disabled={!listo}>
                    Borrar cuenta definitivamente
                  </Boton>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
