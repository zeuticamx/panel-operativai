"use client";

import { useState, type FormEvent } from "react";
import { UserMinus } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { GerenciaUsuarioIn, GerenciaUsuarioOut } from "@/lib/types";
import { formatoFechaHora, tiempoRelativo } from "@/lib/formato";
import { Badge } from "@/app/components/badge";
import { GerenciaTabs } from "@/app/components/gerencia";
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  ConfirmDialog,
  PageHeader,
  inputClass,
} from "@/app/components/ui";

/**
 * Quién tiene nivel gerencia de plataforma. Dar el nivel no crea una
 * cuenta: la persona entra con la suya (correo o Google) y el nivel se
 * engancha por correo.
 */
export default function EquipoPlataformaPage() {
  const usuarios = useApi<GerenciaUsuarioOut[]>("/api/gerencia/usuarios");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<GerenciaUsuarioOut | null>(null);
  const [quitando, setQuitando] = useState(false);

  const quitar = async () => {
    if (!aQuitar) return;
    setQuitando(true);
    setError(null);
    setAviso(null);
    try {
      await apiFetch(`/api/gerencia/usuarios/${aQuitar.id}`, { method: "DELETE" });
      setAviso(`${aQuitar.email} ya no tiene nivel gerencia. Lo pierde en su siguiente clic.`);
      setAQuitar(null);
      await usuarios.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo quitar el nivel."));
    } finally {
      setQuitando(false);
    }
  };

  return (
    <>
      <PageHeader titulo="Equipo de plataforma" acciones={<GerenciaTabs />} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex max-w-3xl flex-col gap-6">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
          {usuarios.error && <Aviso tipo="error">{usuarios.error}</Aviso>}

          <AgregarUsuario
            onAgregado={async (email) => {
              setError(null);
              setAviso(`${email} ahora tiene nivel gerencia.`);
              await usuarios.recargar(true);
            }}
            onError={setError}
          />

          {!usuarios.data && usuarios.loading && <Cargando />}

          {usuarios.data && (
            <ul className="overflow-hidden rounded-md border border-bg-700">
              {usuarios.data.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 border-b border-bg-700 px-3 py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm text-text-100">
                      {u.full_name}
                      {u.es_yo && <Badge tone="info">tú</Badge>}
                      {!u.tiene_cuenta_portal && (
                        <Badge
                          tone="warning"
                          title="No hay cuenta de portal con este correo: el nivel se activa cuando se registre"
                        >
                          sin cuenta
                        </Badge>
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-text-600">
                      {u.email} · {u.cargo}
                    </span>
                  </div>
                  <span
                    className="font-mono text-[11px] text-text-600"
                    title={`alta ${formatoFechaHora(u.creado_en)}`}
                  >
                    {u.ultimo_acceso ? `entró ${tiempoRelativo(u.ultimo_acceso)}` : "nunca entró"}
                  </span>
                  {/* Sin botón para uno mismo: el backend también lo
                      rechaza, y así la tabla nunca queda vacía por la UI. */}
                  {!u.es_yo && (
                    <Boton variante="fantasma" onClick={() => setAQuitar(u)} aria-label={`Quitar a ${u.email}`}>
                      <UserMinus size={13} aria-hidden />
                      Quitar
                    </Boton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={aQuitar !== null}
        onOpenChange={(o) => !o && setAQuitar(null)}
        titulo="¿Quitar nivel gerencia?"
        descripcion={
          aQuitar &&
          `${aQuitar.email} deja de ver el panel de plataforma en su siguiente petición. Su cuenta de portal no se toca.`
        }
        confirmar="Quitar nivel"
        peligro
        loading={quitando}
        onConfirm={quitar}
      />
    </>
  );
}

function AgregarUsuario({
  onAgregado,
  onError,
}: {
  onAgregado: (email: string) => void;
  onError: (e: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const valido = email.includes("@") && nombre.trim().length >= 2 && cargo.trim().length >= 2;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    try {
      const body: GerenciaUsuarioIn = {
        email: email.trim().toLowerCase(),
        full_name: nombre.trim(),
        cargo: cargo.trim(),
      };
      const nuevo = await apiFetch<GerenciaUsuarioOut>("/api/gerencia/usuarios", {
        method: "POST",
        json: body,
      });
      setEmail("");
      setNombre("");
      setCargo("");
      onAgregado(nuevo.email);
    } catch (err) {
      onError(mensajeDeError(err, "No se pudo dar el nivel."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-md border border-bg-700 p-4"
      noValidate
    >
      <h2 className="text-sm font-medium text-text-100">Dar nivel gerencia</h2>
      <p className="text-xs leading-relaxed text-text-400">
        Ve y administra <strong className="text-text-100">todos</strong> los negocios: puede
        suspenderlos, regalar créditos y entrar a su portal en modo lectura. Todo queda en la
        bitácora.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="g-email" label="Correo">
          <input
            id="g-email"
            type="email"
            value={email}
            disabled={enviando}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@operativai.com.mx"
            className={inputClass}
          />
        </Campo>
        <Campo id="g-nombre" label="Nombre">
          <input
            id="g-nombre"
            type="text"
            value={nombre}
            disabled={enviando}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </Campo>
        <Campo id="g-cargo" label="Cargo">
          <input
            id="g-cargo"
            type="text"
            value={cargo}
            disabled={enviando}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Soporte"
            maxLength={100}
            className={inputClass}
          />
        </Campo>
      </div>
      <div>
        <Boton type="submit" variante="primario" loading={enviando} disabled={!valido}>
          Dar nivel
        </Boton>
      </div>
    </form>
  );
}
