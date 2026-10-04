"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleHelp, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RUTAS_PUBLICAS,
  esRutaGerencia,
  marcarRecorridoVisto,
  recorridoParaRuta,
  recorridoVisto,
  type Recorrido,
} from "@/lib/recorridos";
import { useUsuario } from "./usuario-context";

// Ojo: este módulo NO importa ui.tsx. PageHeader (que vive ahí) dibuja
// BotonAyuda, y volver a importar de ahí cerraría el ciclo — mismo caso que
// centro-notificaciones.tsx.

/** Cuánto se espera a que aparezca el ancla (datos que todavía cargan) antes de saltar el paso. */
const ESPERA_ANCLA_MS = 1500;
const INTERVALO_ANCLA_MS = 100;
/** Margen para que la primera visita no arranque sobre una página a medio pintar. */
const RETRASO_AUTO_MS = 600;
const ANCHO_TARJETA = 320;
const MARGEN = 12;

interface CtxRecorrido {
  activo: boolean;
  iniciar: (recorrido: Recorrido) => void;
}

const Ctx = createContext<CtxRecorrido>({ activo: false, iniciar: () => {} });

export function useRecorrido(): CtxRecorrido {
  return useContext(Ctx);
}

function esVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  // El sidebar en móvil está fuera de pantalla a la izquierda: ancho > 0
  // pero `right` <= 0. Ese caso cuenta como no visible.
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
}

function buscarAncla(ancla: string): Element | null {
  return document.querySelector(`[data-tour="${ancla}"]`);
}

/**
 * Dueño del estado del recorrido. Vive en el layout raíz y no en el botón:
 * PageHeader se desmonta y se vuelve a montar al pasar de "cargando" a la
 * página real, y el recorrido no puede morir con él.
 */
export function RecorridoProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [recorrido, setRecorrido] = useState<Recorrido | null>(null);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const direccion = useRef<1 | -1>(1);
  const focoPrevio = useRef<HTMLElement | null>(null);

  const cerrar = useCallback(() => {
    setRecorrido(null);
    setPausado(false);
    const foco = focoPrevio.current;
    focoPrevio.current = null;
    if (foco?.isConnected) foco.focus();
  }, []);

  const iniciar = useCallback(
    (r: Recorrido) => {
      if (pathname && esRutaGerencia(pathname)) return;
      if (recorrido) return;
      focoPrevio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      direccion.current = 1;
      setIndice(0);
      setPausado(false);
      setRecorrido(r);
    },
    [pathname, recorrido],
  );

  // Cambiar de página cierra el recorrido: sus anclas ya no existen. Se
  // ajusta durante el render (mismo patrón que el menú móvil del sidebar).
  const [rutaDelRecorrido, setRutaDelRecorrido] = useState(pathname);
  if (rutaDelRecorrido !== pathname) {
    setRutaDelRecorrido(pathname);
    if (recorrido) {
      setRecorrido(null);
      setPausado(false);
    }
  }

  const mover = useCallback(
    (paso: 1 | -1) => {
      if (!recorrido) return;
      direccion.current = paso;
      const siguiente = indice + paso;
      if (siguiente >= recorrido.pasos.length) cerrar();
      else setIndice(Math.max(0, siguiente));
    },
    [recorrido, indice, cerrar],
  );

  const publico = pathname !== null && RUTAS_PUBLICAS.includes(pathname);

  return (
    <Ctx.Provider value={{ activo: recorrido !== null, iniciar }}>
      {children}
      {publico && <AyudaFlotante />}
      {recorrido && !pausado && (
        <Superposicion
          key={`${recorrido.clave}:${indice}`}
          recorrido={recorrido}
          indice={indice}
          onSaltar={() => mover(direccion.current)}
          onSiguiente={() => mover(1)}
          onAnterior={() => mover(-1)}
          onPausar={() => setPausado(true)}
          onCerrar={cerrar}
        />
      )}
      {recorrido && pausado && (
        <PastillaPausa onReanudar={() => setPausado(false)} onCerrar={cerrar} />
      )}
    </Ctx.Provider>
  );
}

// ------------------------------------------------------------
// Overlay con spotlight + tarjeta anclada
// ------------------------------------------------------------
function Superposicion({
  recorrido,
  indice,
  onSaltar,
  onSiguiente,
  onAnterior,
  onPausar,
  onCerrar,
}: {
  recorrido: Recorrido;
  indice: number;
  onSaltar: () => void;
  onSiguiente: () => void;
  onAnterior: () => void;
  onPausar: () => void;
  onCerrar: () => void;
}) {
  const paso = recorrido.pasos[indice];
  const total = recorrido.pasos.length;
  const ultimo = indice === total - 1;
  const idTitulo = useId();
  const idTexto = useId();
  const tarjetaRef = useRef<HTMLDivElement>(null);
  // undefined = buscando el ancla; null = paso sin ancla (tarjeta centrada).
  const [objetivo, setObjetivo] = useState<Element | null | undefined>(paso.ancla ? undefined : null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // `onSaltar` cambia en cada render del provider; el efecto de búsqueda no
  // debe reiniciarse por eso.
  const saltarRef = useRef(onSaltar);
  useEffect(() => {
    saltarRef.current = onSaltar;
  }, [onSaltar]);

  useEffect(() => {
    if (!paso.ancla) return;
    const ancla = paso.ancla;
    const inicio = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const intentar = () => {
      const el = buscarAncla(ancla);
      if (el && esVisible(el)) {
        el.scrollIntoView?.({ block: "center", inline: "nearest" });
        setObjetivo(el);
        return;
      }
      if (Date.now() - inicio >= ESPERA_ANCLA_MS) {
        saltarRef.current();
        return;
      }
      timer = setTimeout(intentar, INTERVALO_ANCLA_MS);
    };
    intentar();
    return () => clearTimeout(timer);
  }, [paso.ancla]);

  // El rectángulo sigue al elemento si la página hace scroll o cambia de tamaño.
  useEffect(() => {
    if (!objetivo) return;
    const medir = () => setRect(objetivo.getBoundingClientRect());
    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    const ro = new ResizeObserver(medir);
    ro.observe(objetivo);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
      ro.disconnect();
    };
  }, [objetivo]);

  const listo = objetivo === null || rect !== null;

  useEffect(() => {
    if (listo) tarjetaRef.current?.focus();
  }, [listo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") onSiguiente();
      else if (e.key === "ArrowLeft" && indice > 0) onAnterior();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar, onSiguiente, onAnterior, indice]);

  if (!listo) {
    // Mientras se busca el ancla solo se bloquea la página, sin oscurecerla:
    // si el paso termina saltándose no hay parpadeo.
    return createPortal(<div className="fixed inset-0 z-[60]" aria-hidden />, document.body);
  }

  return createPortal(
    <>
      {/* Captura los clics: el recorrido nunca deja que se toque la página
          por accidente, así cerrarlo no cambia nada de lo que había. */}
      <div
        className={cn("fixed inset-0 z-[60]", !rect && "bg-black/55")}
        data-testid="recorrido-bloqueo"
        aria-hidden
      />
      {rect && (
        <div
          className="pointer-events-none fixed z-[61] rounded-md ring-2 ring-white/70 transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
          data-testid="recorrido-spotlight"
          aria-hidden
        />
      )}
      <div
        ref={tarjetaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        tabIndex={-1}
        className="fixed z-[62] flex w-[calc(100%-1.5rem)] flex-col gap-3 rounded-lg border border-bg-700 bg-bg-900 p-4 shadow-xl outline-none sm:w-80"
        style={posicionTarjeta(rect)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-sm font-medium text-text-100">
            {paso.titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar recorrido"
            className="-mt-1 -mr-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-400 hover:bg-hover hover:text-text-100"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
        <p id={idTexto} className="text-xs leading-relaxed text-text-400">
          {paso.texto}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-text-600" aria-live="polite">
            {indice + 1} de {total}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onPausar} className={BOTON_FANTASMA}>
              <Pause size={12} aria-hidden />
              Pausar
            </button>
            <button type="button" onClick={onAnterior} disabled={indice === 0} className={BOTON_FANTASMA}>
              <ChevronLeft size={12} aria-hidden />
              Anterior
            </button>
            <button type="button" onClick={onSiguiente} className={BOTON_PRIMARIO}>
              {ultimo ? "Terminar" : "Siguiente"}
              {!ultimo && <ChevronRight size={12} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

const BOTON_FANTASMA =
  "inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-text-400 hover:bg-hover hover:text-text-100 disabled:cursor-not-allowed disabled:opacity-40";
const BOTON_PRIMARIO =
  "inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md bg-text-100 px-2.5 text-xs font-medium text-bg-950 hover:opacity-90";

/** Debajo del elemento si cabe, si no encima; en móvil, fija abajo; sin ancla, centrada. */
function posicionTarjeta(rect: DOMRect | null): CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < 640) return { left: MARGEN, right: MARGEN, bottom: MARGEN };

  const left = Math.min(Math.max(rect.left, MARGEN), w - ANCHO_TARJETA - MARGEN);
  const alto = 200;
  if (h - rect.bottom >= alto + MARGEN) return { top: rect.bottom + MARGEN, left };
  if (rect.top >= alto + MARGEN) return { bottom: h - rect.top + MARGEN, left };
  // Elemento casi del alto de la pantalla (agenda, tablas largas): esquina.
  return { bottom: MARGEN * 2, right: MARGEN * 2 };
}

function PastillaPausa({ onReanudar, onCerrar }: { onReanudar: () => void; onCerrar: () => void }) {
  return createPortal(
    <div
      role="region"
      aria-label="Recorrido en pausa"
      className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full border border-bg-700 bg-bg-900 py-1 pr-1 pl-3 shadow-lg"
    >
      <span className="font-mono text-[11px] text-text-600">Recorrido en pausa</span>
      <button type="button" onClick={onReanudar} className={BOTON_FANTASMA}>
        <Play size={12} aria-hidden />
        Reanudar
      </button>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar recorrido"
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-text-400 hover:bg-hover hover:text-text-100"
      >
        <X size={12} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------
// Botones de ayuda
// ------------------------------------------------------------
/** Primera visita de esta persona a esta vista: abre el recorrido solo, una vez. */
function useAutoInicio(recorrido: Recorrido | null, usuarioClave: string | null) {
  const { iniciar } = useRecorrido();
  const clave = recorrido?.clave;
  useEffect(() => {
    if (!recorrido || !usuarioClave || recorridoVisto(usuarioClave, recorrido.clave)) return;
    // Se marca al arrancar, no antes: si PageHeader se desmonta durante el
    // retraso (cargando → página), la siguiente instancia lo reprograma.
    const t = setTimeout(() => {
      marcarRecorridoVisto(usuarioClave, recorrido.clave);
      iniciar(recorrido);
    }, RETRASO_AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `recorrido` es estable por clave
  }, [clave, usuarioClave, iniciar]);
}

const CLASE_BOTON_HEADER =
  "relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-400 hover:bg-hover hover:text-text-100";

/**
 * Botón "?" del header. No se dibuja en /gerencia ni en vistas sin recorrido.
 * Arranca solo la primera vez que el cliente entra a la vista, salvo en una
 * sesión "ver como": ahí quien mira es gerencia, no el cliente.
 */
export function BotonAyuda() {
  const pathname = usePathname();
  const { usuario } = useUsuario();
  const { iniciar } = useRecorrido();
  const recorrido = pathname && !esRutaGerencia(pathname) ? recorridoParaRuta(pathname) : null;
  const usuarioClave = usuario && !usuario.impersonado_por ? usuario.id : null;

  useAutoInicio(recorrido, usuarioClave);

  if (!recorrido) return null;
  return (
    <button
      type="button"
      onClick={() => iniciar(recorrido)}
      aria-label="Ver tutorial de esta página"
      title="Tutorial de esta página"
      data-tour="pagina.ayuda"
      className={CLASE_BOTON_HEADER}
    >
      <CircleHelp size={16} aria-hidden />
    </button>
  );
}

/** Variante flotante para login/registro/recuperar, que no tienen header. */
function AyudaFlotante() {
  const pathname = usePathname();
  const { iniciar } = useRecorrido();
  const recorrido = recorridoParaRuta(pathname);

  useAutoInicio(recorrido, "publico");

  if (!recorrido) return null;
  return (
    <button
      type="button"
      onClick={() => iniciar(recorrido)}
      aria-label="Ver tutorial de esta página"
      title="Tutorial de esta página"
      data-tour="publico.ayuda"
      className="fixed right-4 bottom-4 z-40 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-bg-700 bg-bg-900 text-text-400 shadow-lg hover:text-text-100"
    >
      <CircleHelp size={18} aria-hidden />
    </button>
  );
}
