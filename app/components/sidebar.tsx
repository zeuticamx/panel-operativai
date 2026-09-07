"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearTokens } from "@/lib/auth";
import { setStoredTheme, useStoredTheme } from "@/lib/theme";
import { ConfirmDialog } from "./ui";
import { useUsuario } from "./usuario-context";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: MessagesSquare, label: "Conversaciones", href: "/conversaciones" },
  { icon: Plug, label: "Canales", href: "/canales" },
  { icon: Bot, label: "Agente", href: "/agente" },
  { icon: Wrench, label: "Herramientas", href: "/herramientas" },
  { icon: Users, label: "Vendedores", href: "/vendedores" },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useStoredTheme();
  const isLight = theme === "light";
  const { usuario } = useUsuario();

  useEffect(() => {
    document.documentElement.classList.toggle("light", isLight);
  }, [isLight]);

  const handleLogout = () => {
    clearTokens();
    setConfirmOpen(false);
    router.replace("/login");
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-bg-700 bg-bg-900 transition-[width] duration-150",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex items-center justify-between px-3 py-3">
        {!collapsed && (
          <Image
            src="/imagenes/LOGO_OPERATIVAI.png"
            alt="OperativAI"
            width={240}
            height={64}
            className="h-auto w-40"
            priority
          />
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="cursor-pointer rounded p-1 text-text-400 hover:bg-bg-800 hover:text-text-100"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Negocio actual */}
      {!collapsed && (
        <div className="mx-2 mb-2 rounded-md border border-bg-700 bg-bg-950 px-2.5 py-2">
          <div className="truncate text-xs font-medium text-text-100">
            {usuario?.nombre_negocio ?? " "}
          </div>
          <div className="truncate font-mono text-[11px] text-text-600">
            {usuario?.email ?? "cargando…"}
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Principal">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded px-2 py-1.5 text-sm",
                active
                  ? "bg-bg-800 text-text-100"
                  : "text-text-400 hover:bg-bg-800 hover:text-text-100",
              )}
            >
              <Icon size={16} className="shrink-0" aria-hidden />
              {!collapsed && <span className="flex-1">{label}</span>}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-text-400 hover:bg-bg-800 hover:text-text-100"
          aria-expanded={settingsOpen}
          title={collapsed ? "Preferencias" : undefined}
        >
          <Settings size={16} className="shrink-0" aria-hidden />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Preferencias</span>
              <ChevronDown
                size={14}
                className={cn("shrink-0 transition-transform", settingsOpen && "rotate-180")}
                aria-hidden
              />
            </>
          )}
        </button>

        {settingsOpen && !collapsed && (
          <div className="ml-2 flex flex-col border-l border-bg-700 pl-3">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="flex items-center gap-2 text-sm text-text-400">
                {isLight ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
                Tema {isLight ? "claro" : "oscuro"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isLight}
                aria-label="Cambiar entre tema claro y oscuro"
                onClick={() => setStoredTheme(isLight ? "dark" : "light")}
                className={cn(
                  "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border border-bg-600 transition-colors",
                  isLight ? "bg-text-400" : "bg-bg-800",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-text-100 transition-transform",
                    isLight && "translate-x-4",
                  )}
                />
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-bg-700 px-2 py-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-text-400 hover:bg-bg-800 hover:text-danger"
          aria-label="Cerrar sesión"
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <LogOut size={16} className="shrink-0" aria-hidden />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          titulo="¿Cerrar sesión?"
          descripcion="Vas a tener que volver a iniciar sesión para entrar al portal."
          confirmar="Cerrar sesión"
          peligro
          onConfirm={handleLogout}
        />
      </div>
    </aside>
  );
}
