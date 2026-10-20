"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatoFechaHora } from "@/lib/formato";
import { CATEGORIA_ETIQUETA, ESTADO_PLANTILLA, textoDe } from "@/lib/plantillas";
import type {
  CategoriaPlantilla,
  EstadoPlantillaMeta,
  PlantillaPruebaIn,
  PlantillaTenantOut,
} from "@/lib/types";
import { Badge } from "@/app/components/badge";
import { FormularioVariables } from "@/app/components/plantillas/formulario-variables";
import { VistaPreviaWhatsapp } from "@/app/components/plantillas/vista-previa-whatsapp";
import { useUsuario } from "@/app/components/usuario-context";
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  claseBoton,
  ConfirmDialog,
  inputClass,
  PageHeader,
  selectClass,
} from "@/app/components/ui";

const RUTA = "/api/plantillas-whatsapp";

export default function PlantillasPage() {
  const { usuario } = useUsuario();
  // El backend es quien decide (member solo lee); esto evita ofrecer botones que darían 403.
  const puedeGestionar = usuario?.role === "owner" || usuario?.role === "superadmin";

  const [categoria, setCategoria] = useState<CategoriaPlantilla | "">("");
  const [estado, setEstado] = useState<EstadoPlantillaMeta | "">("");
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (estado) params.set("estado", estado);
  const query = params.toString();
  const plantillas = useApi<PlantillaTenantOut[]>(`${RUTA}${query ? `?${query}` : ""}`);

  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [aBorrar, setABorrar] = useState<PlantillaTenantOut | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [aProbar, setAProbar] = useState<PlantillaTenantOut | null>(null);

  const sincronizar = async () => {
    setSincronizando(true);
    setMensaje(null);
    try {
      await apiFetch(`${RUTA}?sincronizar=true`);
      await plantillas.recargar(true);
      setMensaje({ tipo: "exito", texto: "Catálogo sincronizado con Meta." });
    } catch (e) {
      setMensaje({ tipo: "error", texto: mensajeDeError(e, "No se pudo sincronizar con Meta.") });
    } finally {
      setSincronizando(false);
    }
  };

  const borrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    setMensaje(null);
    try {
      await apiFetch(`${RUTA}/${encodeURIComponent(aBorrar.nombre)}?confirmar=true`, {
        method: "DELETE",
      });
      setABorrar(null);
      await plantillas.recargar(true);
    } catch (e) {
      setABorrar(null);
      setMensaje({ tipo: "error", texto: mensajeDeError(e, "No se pudo eliminar la plantilla.") });
    } finally {
      setBorrando(false);
    }
  };

  return (
    <>
      <PageHeader
        titulo="Plantillas"
        sub="mensajes aprobados por Meta para escribir fuera de la ventana de 24 h"
        acciones={
          <>
            <Boton onClick={sincronizar} loading={sincronizando}>
              <RefreshCw size={13} aria-hidden /> Sincronizar
            </Boton>
            {puedeGestionar && (
              <Link href="/plantillas/nueva" className={claseBoton("primario")}>
                <Plus size={13} aria-hidden /> Nueva plantilla
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 px-4 pb-8 md:px-6">
        {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Campo id="f-categoria" label="Categoría">
            <select
              id="f-categoria"
              className={selectClass}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaPlantilla | "")}
            >
              <option value="">Todas</option>
              {(Object.keys(CATEGORIA_ETIQUETA) as CategoriaPlantilla[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_ETIQUETA[c]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="f-estado" label="Estado">
            <select
              id="f-estado"
              className={selectClass}
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoPlantillaMeta | "")}
            >
              <option value="">Todos</option>
              {(Object.keys(ESTADO_PLANTILLA) as EstadoPlantillaMeta[]).map((s) => (
                <option key={s} value={s}>
                  {ESTADO_PLANTILLA[s].etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {plantillas.error && <Aviso tipo="error">{plantillas.error}</Aviso>}
        {plantillas.loading && !plantillas.data && <Cargando />}

        {plantillas.data && plantillas.data.length === 0 && (
          <Aviso>
            No hay plantillas{query ? " con esos filtros" : " guardadas todavía"}. Si ya las tienes en
            Meta, usa «Sincronizar».
          </Aviso>
        )}

        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plantillas.data?.map((p) => {
            const info = ESTADO_PLANTILLA[p.estado];
            return (
              <li
                key={`${p.nombre}-${p.idioma}`}
                className="flex flex-col gap-3 rounded-lg border border-bg-700 bg-bg-900 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-text-100">{p.nombre}</p>
                    <p className="text-[11px] text-text-600">
                      {CATEGORIA_ETIQUETA[p.categoria]} · {p.idioma} · {formatoFechaHora(p.actualizada_en)}
                    </p>
                  </div>
                  <Badge tone={info.tono}>{info.etiqueta}</Badge>
                </div>

                <VistaPreviaWhatsapp
                  encabezado={textoDe(p.componentes, "HEADER")}
                  cuerpo={textoDe(p.componentes, "BODY") ?? ""}
                  pie={textoDe(p.componentes, "FOOTER")}
                />

                {p.motivo_rechazo && (
                  <Aviso tipo="error">Motivo de Meta: {p.motivo_rechazo}</Aviso>
                )}

                {puedeGestionar && (
                  <div className="mt-auto flex flex-wrap justify-end gap-2">
                    <Boton disabled={p.estado !== "APPROVED"} onClick={() => setAProbar(p)}>
                      <Send size={13} aria-hidden /> Probar
                    </Boton>
                    <Boton variante="fantasma" onClick={() => setABorrar(p)} aria-label={`Eliminar ${p.nombre}`}>
                      <Trash2 size={13} aria-hidden /> Eliminar
                    </Boton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={aBorrar !== null}
        onOpenChange={(o) => !o && !borrando && setABorrar(null)}
        titulo={`¿Eliminar «${aBorrar?.nombre ?? ""}»?`}
        descripcion="Se borra de forma permanente en Meta y no se puede deshacer. Para volver a usarla tendrías que crearla y esperar otra aprobación."
        confirmar="Eliminar"
        peligro
        loading={borrando}
        onConfirm={borrar}
      />

      {aProbar && <DialogoPrueba plantilla={aProbar} onCerrar={() => setAProbar(null)} />}
    </>
  );
}

function DialogoPrueba({ plantilla, onCerrar }: { plantilla: PlantillaTenantOut; onCerrar: () => void }) {
  const [telefono, setTelefono] = useState("");
  const [encabezado, setEncabezado] = useState("");
  const [cuerpo, setCuerpo] = useState<string[]>(Array(plantilla.variables_cuerpo).fill(""));
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const enviar = async () => {
    setEnviando(true);
    setResultado(null);
    const datos: PlantillaPruebaIn = {
      telefono,
      valores_cuerpo: cuerpo,
      valor_encabezado: plantilla.variable_encabezado ? encabezado : undefined,
    };
    try {
      await apiFetch(`${RUTA}/${encodeURIComponent(plantilla.nombre)}/prueba`, {
        method: "POST",
        json: datos,
      });
      setResultado({ tipo: "exito", texto: "Mensaje de prueba enviado." });
    } catch (e) {
      setResultado({ tipo: "error", texto: mensajeDeError(e, "No se pudo enviar la prueba.") });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !enviando && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <Dialog.Title className="text-sm font-medium text-text-100">
            Enviar prueba de «{plantilla.nombre}»
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-text-400">
            Se envía desde la línea de WhatsApp de tu negocio. Usa un número tuyo o de tu equipo.
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-3">
            <Campo id="prueba-tel" label="Teléfono (con código de país)" hint="Ej. 593999999999">
              <input
                id="prueba-tel"
                inputMode="tel"
                className={inputClass}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </Campo>
            <FormularioVariables
              idBase="prueba"
              tieneEncabezado={plantilla.variable_encabezado}
              cantidadCuerpo={plantilla.variables_cuerpo}
              valorEncabezado={encabezado}
              valoresCuerpo={cuerpo}
              onEncabezado={setEncabezado}
              onCuerpo={setCuerpo}
              deshabilitado={enviando}
            />
            <VistaPreviaWhatsapp
              encabezado={textoDe(plantilla.componentes, "HEADER")}
              cuerpo={textoDe(plantilla.componentes, "BODY") ?? ""}
              pie={textoDe(plantilla.componentes, "FOOTER")}
              valoresEncabezado={[encabezado]}
              valoresCuerpo={cuerpo}
            />
            {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Boton onClick={onCerrar} disabled={enviando}>
              Cerrar
            </Boton>
            <Boton variante="primario" loading={enviando} disabled={!telefono.trim()} onClick={enviar}>
              Enviar prueba
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
