"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Lock,
  LogOut,
  MessagesSquare,
  Moon,
  MoreHorizontal,
  Plug,
  ShieldCheck,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearTokens } from "@/lib/auth";
import { iniciales, useFotoPerfil } from "@/lib/foto-perfil";
import { bloqueoDePantalla } from "@/lib/herramientas-plan";
import { setStoredTheme, useStoredTheme } from "@/lib/theme";
import { AvatarPerfil } from "./avatar-perfil";
import { esGerenciaPlataforma } from "./gerencia";
import { transferenciasPendientes } from "@/lib/use-websocket-alertas";
import { useAlertas } from "./alertas-context";
import { usePlan } from "./plan-context";
import { ReportarProblema } from "./reportar-problema";
import { ConfirmDialog } from "./ui";
import { useUsuario } from "./usuario-context";

type Item = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  /** Etiqueta para la barra inferior móvil, donde el ancho es poco. */
  corto?: string;
  href: string;
};

// Agrupado por intención: lo que se usa a diario arriba, lo que se configura
// una vez después. El rail muestra siempre ícono + etiqueta: no hay modo
// colapsado que esconda a dónde lleva cada ícono.
const NAV_GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Operación",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", corto: "Inicio", href: "/dashboard" },
      { icon: MessagesSquare, label: "Conversaciones", corto: "Chats", href: "/conversaciones" },
      { icon: CalendarDays, label: "Calendario", corto: "Agenda", href: "/calendario" },
    ],
  },
  {
    titulo: "Configurar",
    items: [
      { icon: Plug, label: "Canales", href: "/canales" },
      { icon: Bot, label: "Agente", href: "/agente" },
      { icon: Wrench, label: "Herramientas", href: "/herramientas" },
      { icon: Users, label: "Vendedores", href: "/vendedores" },
    ],
  },
];

const NAV_SUSCRIPCION: Item = { icon: CreditCard, label: "Suscripción", href: "/suscripcion" };

// Sección del equipo de OperativAI, no del negocio. Va aparte y al final
// para que se lea como lo que es: otro nivel, no una pantalla más del
// portal del cliente.
const NAV_PLATAFORMA: Item = { icon: ShieldCheck, label: "Plataforma", href: "/gerencia" };

const TODOS = [...NAV_GRUPOS.flatMap((g) => g.items), NAV_SUSCRIPCION];

// Barra inferior móvil: los cuatro destinos de uso diario, al alcance del
// pulgar; el resto vive en "Más".
const MOVIL_HREFS = ["/dashboard", "/conversaciones", "/calendario", "/agente"];
const MOVIL = MOVIL_HREFS.map((href) => TODOS.find((i) => i.href === href)!);

function esActivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function BadgePendientes({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`${n} conversaciones esperando atención humana`}
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] leading-none font-medium text-white",
        className,
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const theme = useStoredTheme();
  const isLight = theme === "light";
  const { usuario } = useUsuario();
  const { acceso } = usePlan();
  const { alertas } = useAlertas();
  const pendientes = transferenciasPendientes(alertas).length;
  const fotoUrl = useFotoPerfil(usuario?.foto_version);
  const nombrePerfil =
    [usuario?.nombres, usuario?.apellido_paterno].filter(Boolean).join(" ") || usuario?.email || "";
  const faltaPerfil = usuario !== null && usuario.perfil_completo === false;
  const esPlataforma = esGerenciaPlataforma(usuario);
  const inicialesPerfil = usuario ? iniciales(usuario.nombres, usuario.apellido_paterno, usuario.email) : "";

  useEffect(() => {
    document.documentElement.classList.toggle("light", isLight);
  }, [isLight]);

  // El panel se cierra solo al cambiar de ruta, para que no quede tapando
  // la pantalla después de tocar un link. Se ajusta durante el render y no
  // en un effect (react-hooks/set-state-in-effect): es el patrón de React
  // para "resetear estado cuando cambia un valor".
  const [rutaDelPanel, setRutaDelPanel] = useState(pathname);
  if (rutaDelPanel !== pathname) {
    setRutaDelPanel(pathname);
    setPanelOpen(false);
  }

  // Escape y clic fuera cierran el panel. Los botones que lo abren llevan
  // data-abre-panel para que su propio clic no lo cierre y reabra.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (panelRef.current?.contains(t) || t?.closest("[data-abre-panel]")) return;
      setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [panelOpen]);

  const handleLogout = () => {
    clearTokens();
    setConfirmOpen(false);
    router.replace("/login");
  };

  // Fuera del plan el link sigue ahí (lleva a la vista que explica cómo
  // conseguirlo); el candado solo avisa antes de entrar.
  const bloqueado = (href: string) => acceso !== null && bloqueoDePantalla(acceso, href) !== null;

  const railLink = ({ icon: Icon, label, href }: Item, className?: string) => {
    const active = esActivo(pathname, href);
    const sinPlan = bloqueado(href);
    return (
      <Link
        key={href}
        href={href}
        title={sinPlan ? "No incluido en tu plan actual" : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] leading-tight font-medium transition-colors",
          active ? "bg-accent-soft text-accent" : "text-text-400 hover:bg-hover hover:text-text-100",
          className,
        )}
      >
        {active && (
          <span className="absolute top-2.5 bottom-2.5 -left-2 w-[3px] rounded-r bg-accent" aria-hidden />
        )}
        <Icon size={20} className="shrink-0" aria-hidden />
        <span className="max-w-full truncate">{label}</span>
        {href === "/conversaciones" && (
          <BadgePendientes n={pendientes} className="absolute top-1 right-2" />
        )}
        {sinPlan && (
          <Lock size={11} className="absolute top-1.5 right-2 text-text-600" aria-label="No incluido en tu plan" />
        )}
      </Link>
    );
  };

  const restoMovil = [
    ...TODOS.filter((i) => !MOVIL_HREFS.includes(i.href)),
    ...(esPlataforma ? [NAV_PLATAFORMA] : []),
  ];
  const masActivo =
    restoMovil.some((i) => esActivo(pathname, i.href)) || pathname === "/preferencias";

  return (
    <>
      {/* ---------- Rail de escritorio ---------- */}
      <aside className="hidden w-[88px] shrink-0 flex-col border-r border-bg-700 bg-bg-900 px-2 py-3 md:flex">
        <Link
          href="/dashboard"
          aria-label="OperativAI, ir al inicio"
          className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- .ico local, next/image no aporta */}
          <img src="/operativai.ico" alt="" width={32} height={32} />
        </Link>

        <nav
          data-tour="nav.principal"
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
          aria-label="Principal"
        >
          {NAV_GRUPOS.map((grupo, i) => (
            <div key={grupo.titulo} className="flex flex-col gap-0.5">
              {i > 0 && <div className="mx-3 my-2 h-px bg-bg-700" aria-hidden />}
              <span className="my-1 text-center text-[10px] tracking-wider text-text-600 uppercase">
                {grupo.titulo}
              </span>
              {grupo.items.map((item) => railLink(item))}
            </div>
          ))}
          <div className="flex-1" />
          {railLink(NAV_SUSCRIPCION)}
          {/* Solo para el nivel gerencia de plataforma. El backend lo
              vuelve a comprobar en cada endpoint: esconder el link es
              para no ofrecer una puerta que no abre, no la seguridad. */}
          {esPlataforma && railLink(NAV_PLATAFORMA, "mt-1")}
        </nav>

        <button
          type="button"
          data-abre-panel
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="panel-cuenta"
          aria-label={faltaPerfil ? "Cuenta (faltan datos del perfil)" : "Cuenta"}
          className={cn(
            "relative mx-auto mt-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-hover",
            panelOpen && "bg-hover",
          )}
        >
          <AvatarPerfil src={fotoUrl} iniciales={inicialesPerfil} tamano={32} />
          {faltaPerfil && (
            <span
              className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-bg-900 bg-warning"
              aria-hidden
            />
          )}
        </button>
      </aside>

      {/* ---------- Barra inferior móvil ---------- */}
      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 gap-1 border-t border-bg-700 bg-bg-900 px-1 py-1.5 md:hidden"
      >
        {MOVIL.map(({ icon: Icon, label, corto, href }) => {
          const active = esActivo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
                active ? "bg-accent-soft text-accent" : "text-text-400",
              )}
            >
              <Icon size={21} aria-hidden />
              {corto ?? label}
              {href === "/conversaciones" && (
                <BadgePendientes n={pendientes} className="absolute top-0.5 right-3" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          data-abre-panel
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="panel-cuenta"
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium",
            masActivo || panelOpen ? "bg-accent-soft text-accent" : "text-text-400",
          )}
        >
          <MoreHorizontal size={21} aria-hidden />
          Más
          {faltaPerfil && (
            <span className="absolute top-1.5 right-4 h-2 w-2 rounded-full bg-warning" aria-hidden />
          )}
        </button>
      </nav>

      {/* ---------- Panel de cuenta (y "Más" en móvil) ----------
          Una sola instancia para escritorio y móvil, oculta con `hidden`
          en vez de desmontada: el modal de "Reportar un problema" vive
          dentro y no puede perderse cuando el panel se cierra. */}
      {panelOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-hidden />}
      <div
        id="panel-cuenta"
        ref={panelRef}
        hidden={!panelOpen}
        className="fixed inset-x-3 bottom-[4.5rem] z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-bg-700 bg-bg-800 p-2 shadow-xl md:inset-x-auto md:bottom-3 md:left-[96px] md:w-64"
      >
        <div className="mb-2 grid grid-cols-3 gap-1 border-b border-bg-700 pb-2 md:hidden">
          {restoMovil.map(({ icon: Icon, label, href }) => {
            const active = esActivo(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium",
                  active ? "bg-accent-soft text-accent" : "text-text-400 hover:bg-hover hover:text-text-100",
                )}
              >
                <Icon size={20} aria-hidden />
                {label}
                {bloqueado(href) && (
                  <Lock size={11} className="absolute top-1.5 right-2 text-text-600" aria-label="No incluido en tu plan" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Perfil personal: el negocio y el correo se ven en /preferencias.
            El aviso queda mientras el perfil esté incompleto. */}
        {usuario && (
          <Link
            href="/preferencias"
            aria-current={pathname === "/preferencias" ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-sm",
              pathname === "/preferencias"
                ? "bg-hover text-text-100"
                : "text-text-400 hover:bg-hover hover:text-text-100",
            )}
          >
            <span className="relative shrink-0">
              <AvatarPerfil src={fotoUrl} iniciales={inicialesPerfil} tamano={28} />
              {faltaPerfil && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-bg-800 bg-warning"
                  aria-hidden
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-text-100">{nombrePerfil}</span>
              {faltaPerfil ? (
                <span className="truncate font-mono text-[11px] text-warning">completa tu perfil</span>
              ) : (
                <span className="truncate text-xs text-text-600">Mi perfil</span>
              )}
            </span>
          </Link>
        )}

        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <span className="flex items-center gap-2.5 text-sm text-text-400">
            {isLight ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            Tema {isLight ? "claro" : "oscuro"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isLight}
            aria-label="Cambiar entre tema claro y oscuro"
            onClick={() => setStoredTheme(isLight ? "dark" : "light")}
            className={cn(
              "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors",
              isLight ? "border-accent bg-accent" : "border-bg-600 bg-bg-900",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full transition-transform",
                isLight ? "translate-x-4 bg-accent-on" : "bg-text-100",
              )}
            />
          </button>
        </div>

        <div className="my-1 h-px bg-bg-700" aria-hidden />
        <ReportarProblema />
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-text-400 hover:bg-hover hover:text-danger"
        >
          <LogOut size={16} className="shrink-0" aria-hidden />
          <span>Cerrar sesión</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        titulo="¿Cerrar sesión?"
        descripcion="Vas a tener que volver a iniciar sesión para entrar al portal."
        confirmar="Cerrar sesión"
        peligro
        onConfirm={handleLogout}
      />
    </>
  );
}
