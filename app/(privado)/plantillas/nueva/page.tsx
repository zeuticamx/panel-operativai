"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import {
  aSlug,
  CATEGORIA_ETIQUETA,
  cantidadDeVariables,
  MAX_CUERPO,
  MAX_ENCABEZADO,
  MAX_PIE,
  NOMBRE_RE,
  variablesConsecutivas,
} from "@/lib/plantillas";
import type { CategoriaPlantilla, PlantillaBotonIn, PlantillaCrearIn } from "@/lib/types";
import { FormularioVariables } from "@/app/components/plantillas/formulario-variables";
import { VistaPreviaWhatsapp } from "@/app/components/plantillas/vista-previa-whatsapp";
import { useUsuario } from "@/app/components/usuario-context";
import {
  Aviso,
  Boton,
  Campo,
  claseBoton,
  inputClass,
  PageHeader,
  selectClass,
} from "@/app/components/ui";

const MAX_BOTONES_UI = 3;

export default function NuevaPlantillaPage() {
  const router = useRouter();
  const { usuario } = useUsuario();
  const puedeGestionar = usuario?.role === "owner" || usuario?.role === "superadmin";

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<CategoriaPlantilla>("UTILITY");
  const [idioma, setIdioma] = useState("es_MX");
  const [encabezado, setEncabezado] = useState("");
  const [ejemploEncabezado, setEjemploEncabezado] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [ejemplos, setEjemplos] = useState<string[]>([]);
  const [pie, setPie] = useState("");
  const [botones, setBotones] = useState<PlantillaBotonIn[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nVariables = cantidadDeVariables(cuerpo);
  const tieneVariableEncabezado = cantidadDeVariables(encabezado) > 0;
  const ejemplosCuerpo = useMemo(
    () => Array.from({ length: nVariables }, (_, i) => ejemplos[i] ?? ""),
    [ejemplos, nVariables],
  );

  const problemas: string[] = [];
  if (!NOMBRE_RE.test(nombre)) problemas.push("El nombre solo admite minúsculas, números y guion bajo.");
  if (!cuerpo.trim()) problemas.push("Escribe el cuerpo del mensaje.");
  if (!variablesConsecutivas(cuerpo)) problemas.push("Las variables del cuerpo deben ser {{1}}, {{2}}… sin saltos.");
  if (nVariables > 0 && (/^\s*\{\{\s*\d+\s*\}\}/.test(cuerpo) || /\{\{\s*\d+\s*\}\}\s*$/.test(cuerpo)))
    problemas.push("El cuerpo no puede empezar ni terminar con una variable.");
  if (ejemplosCuerpo.some((e) => !e.trim())) problemas.push("Falta un ejemplo para cada variable del cuerpo.");
  if (tieneVariableEncabezado && !ejemploEncabezado.trim()) problemas.push("Falta el ejemplo de la variable del encabezado.");
  if (cantidadDeVariables(pie) > 0) problemas.push("El pie no admite variables.");
  if (botones.some((b) => !b.texto.trim())) problemas.push("Todos los botones necesitan texto.");

  const crear = async () => {
    setEnviando(true);
    setError(null);
    const datos: PlantillaCrearIn = {
      nombre,
      idioma,
      categoria,
      encabezado: encabezado.trim() || undefined,
      ejemplo_encabezado: tieneVariableEncabezado ? ejemploEncabezado : undefined,
      cuerpo,
      ejemplos_cuerpo: ejemplosCuerpo,
      pie: pie.trim() || undefined,
      botones,
    };
    try {
      await apiFetch("/api/plantillas-whatsapp", { method: "POST", json: datos });
      router.push("/plantillas");
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo enviar la plantilla a Meta."));
      setEnviando(false);
    }
  };

  const cambiarBoton = (i: number, cambio: Partial<PlantillaBotonIn>) =>
    setBotones((bs) => bs.map((b, j) => (j === i ? { ...b, ...cambio } : b)));

  if (usuario && !puedeGestionar) {
    return (
      <>
        <PageHeader titulo="Nueva plantilla" />
        <div className="px-4 md:px-6">
          <Aviso tipo="error">Solo el dueño o un administrador pueden crear plantillas.</Aviso>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Nueva plantilla"
        sub="Meta la revisa antes de poder usarla; suele tardar de minutos a 24 h"
        acciones={
          <Link href="/plantillas" className={claseBoton("secundario")}>
            Volver
          </Link>
        }
      />

      <div className="grid gap-6 px-4 pb-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (problemas.length === 0) void crear();
          }}
        >
          <Campo id="p-nombre" label="Nombre" hint="Identificador interno, ej. recordatorio_cita">
            <input
              id="p-nombre"
              className={inputClass}
              value={nombre}
              maxLength={512}
              onChange={(e) => setNombre(aSlug(e.target.value))}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              id="p-categoria"
              label="Categoría"
              hint={categoria === "MARKETING" ? "Promociones; Meta las cobra distinto" : undefined}
            >
              <select
                id="p-categoria"
                className={selectClass}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaPlantilla)}
              >
                {(Object.keys(CATEGORIA_ETIQUETA) as CategoriaPlantilla[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_ETIQUETA[c]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="p-idioma" label="Idioma">
              <select id="p-idioma" className={selectClass} value={idioma} onChange={(e) => setIdioma(e.target.value)}>
                <option value="es_MX">Español (México)</option>
                <option value="es">Español</option>
                <option value="es_ES">Español (España)</option>
                <option value="en_US">Inglés (EE. UU.)</option>
                <option value="pt_BR">Portugués (Brasil)</option>
              </select>
            </Campo>
          </div>

          <Campo
            id="p-encabezado"
            label="Encabezado (opcional)"
            hint={`${encabezado.length}/${MAX_ENCABEZADO} · admite una variable {{1}}`}
          >
            <input
              id="p-encabezado"
              className={inputClass}
              value={encabezado}
              maxLength={MAX_ENCABEZADO}
              onChange={(e) => setEncabezado(e.target.value)}
            />
          </Campo>
          {tieneVariableEncabezado && (
            <Campo id="p-ej-enc" label="Ejemplo de {{1}} en el encabezado">
              <input
                id="p-ej-enc"
                className={inputClass}
                value={ejemploEncabezado}
                onChange={(e) => setEjemploEncabezado(e.target.value)}
              />
            </Campo>
          )}

          <Campo
            id="p-cuerpo"
            label="Cuerpo"
            hint={`${cuerpo.length}/${MAX_CUERPO} · usa {{1}}, {{2}}… para datos que cambian`}
          >
            <textarea
              id="p-cuerpo"
              rows={6}
              className={inputClass}
              value={cuerpo}
              maxLength={MAX_CUERPO}
              onChange={(e) => setCuerpo(e.target.value)}
            />
          </Campo>

          {nVariables > 0 && (
            <fieldset className="flex flex-col gap-2 rounded-md border border-bg-700 p-3">
              <legend className="px-1 text-xs text-text-400">Ejemplos que verá Meta al revisar</legend>
              <FormularioVariables
                idBase="ej"
                tieneEncabezado={false}
                cantidadCuerpo={nVariables}
                valorEncabezado=""
                valoresCuerpo={ejemplosCuerpo}
                onEncabezado={() => {}}
                onCuerpo={setEjemplos}
              />
            </fieldset>
          )}

          <Campo id="p-pie" label="Pie (opcional)" hint={`${pie.length}/${MAX_PIE} · sin variables`}>
            <input
              id="p-pie"
              className={inputClass}
              value={pie}
              maxLength={MAX_PIE}
              onChange={(e) => setPie(e.target.value)}
            />
          </Campo>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-400">Botones (opcional, hasta {MAX_BOTONES_UI})</p>
            {botones.map((b, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-bg-700 p-2 sm:flex-row sm:items-center">
                <select
                  aria-label={`Tipo del botón ${i + 1}`}
                  className={selectClass + " sm:w-40"}
                  value={b.tipo}
                  onChange={(e) => cambiarBoton(i, { tipo: e.target.value as PlantillaBotonIn["tipo"] })}
                >
                  <option value="QUICK_REPLY">Respuesta rápida</option>
                  <option value="URL">Enlace</option>
                  <option value="PHONE_NUMBER">Llamar</option>
                </select>
                <input
                  aria-label={`Texto del botón ${i + 1}`}
                  placeholder="Texto (máx. 25)"
                  maxLength={25}
                  className={inputClass}
                  value={b.texto}
                  onChange={(e) => cambiarBoton(i, { texto: e.target.value })}
                />
                {b.tipo === "URL" && (
                  <input
                    aria-label={`Enlace del botón ${i + 1}`}
                    placeholder="https://…"
                    className={inputClass}
                    value={b.url ?? ""}
                    onChange={(e) => cambiarBoton(i, { url: e.target.value })}
                  />
                )}
                {b.tipo === "PHONE_NUMBER" && (
                  <input
                    aria-label={`Teléfono del botón ${i + 1}`}
                    placeholder="+593999999999"
                    className={inputClass}
                    value={b.telefono ?? ""}
                    onChange={(e) => cambiarBoton(i, { telefono: e.target.value })}
                  />
                )}
                <Boton
                  variante="fantasma"
                  aria-label={`Quitar botón ${i + 1}`}
                  onClick={() => setBotones((bs) => bs.filter((_, j) => j !== i))}
                >
                  <Trash2 size={13} aria-hidden />
                </Boton>
              </div>
            ))}
            {botones.length < MAX_BOTONES_UI && (
              <Boton
                className="self-start"
                onClick={() => setBotones((bs) => [...bs, { tipo: "QUICK_REPLY", texto: "" }])}
              >
                <Plus size={13} aria-hidden /> Añadir botón
              </Boton>
            )}
          </div>

          {error && <Aviso tipo="error">{error}</Aviso>}
          {problemas.length > 0 && (nombre || cuerpo) && (
            <ul className="list-disc space-y-0.5 pl-5 font-mono text-[11px] text-warning">
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <Boton
              variante="primario"
              type="submit"
              loading={enviando}
              disabled={problemas.length > 0}
            >
              Enviar a Meta para aprobación
            </Boton>
          </div>
        </form>

        <aside className="lg:sticky lg:top-4 lg:self-start" aria-label="Vista previa">
          <p className="mb-2 text-xs text-text-400">Vista previa</p>
          <VistaPreviaWhatsapp
            encabezado={encabezado}
            cuerpo={cuerpo}
            pie={pie}
            botones={botones}
            valoresEncabezado={[ejemploEncabezado]}
            valoresCuerpo={ejemplosCuerpo}
          />
        </aside>
      </div>
    </>
  );
}
