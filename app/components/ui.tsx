"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------
// Clases compartidas de formularios (misma familia visual que login)
// ------------------------------------------------------------
export const inputClass =
  "w-full rounded-md border border-bg-700 bg-bg-900 px-3 py-2 text-sm text-text-100 placeholder:text-text-600 focus:outline-none focus:border-bg-600 disabled:opacity-50";

export const selectClass =
  "w-full cursor-pointer rounded-md border border-bg-700 bg-bg-900 px-3 py-2 text-sm text-text-100 focus:outline-none focus:border-bg-600 disabled:opacity-50";

export function Campo({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs text-text-400">
        {label}
      </label>
      {children}
      {error ? (
        <span className="font-mono text-[11px] text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="font-mono text-[11px] text-text-600">{hint}</span>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Botones
// ------------------------------------------------------------
type Variante = "primario" | "secundario" | "peligro" | "fantasma";

const VARIANTE: Record<Variante, string> = {
  primario: "bg-success text-bg-950 hover:opacity-90",
  secundario: "border border-bg-700 text-text-100 hover:bg-bg-800",
  peligro: "bg-danger text-white hover:opacity-90",
  fantasma: "text-text-400 hover:bg-bg-800 hover:text-text-100",
};

export function Boton({
  variante = "secundario",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTE[variante],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={13} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ------------------------------------------------------------
// Aviso inline (error / éxito / info)
// ------------------------------------------------------------
const AVISO = {
  error: { icon: AlertCircle, cls: "border-danger/40 bg-danger/10 text-danger" },
  exito: { icon: CheckCircle2, cls: "border-success/40 bg-success-bg text-success" },
  info: { icon: Info, cls: "border-bg-700 bg-bg-900 text-text-400" },
} as const;

export function Aviso({
  tipo = "info",
  children,
  className,
}: {
  tipo?: keyof typeof AVISO;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = AVISO[tipo];
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed",
        cls,
        className,
      )}
    >
      <Icon size={13} className="mt-px shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

// ------------------------------------------------------------
// Encabezado de página (mismo patrón del hermano)
// ------------------------------------------------------------
export function PageHeader({
  titulo,
  sub,
  acciones,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-bg-700 px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-sm font-medium text-text-100">{titulo}</h1>
        {sub && <span className="font-mono text-xs text-text-600">{sub}</span>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

export function Cargando({ texto = "cargando…" }: { texto?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 font-mono text-xs text-text-600">
      {texto}
    </div>
  );
}

// ------------------------------------------------------------
// Diálogo de confirmación
// ------------------------------------------------------------
export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  confirmar = "Confirmar",
  peligro = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  descripcion?: ReactNode;
  confirmar?: string;
  peligro?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <Dialog.Title className="text-sm font-medium text-text-100">{titulo}</Dialog.Title>
          {descripcion && (
            <Dialog.Description className="mt-1.5 text-xs text-text-400">
              {descripcion}
            </Dialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={loading}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton
              variante={peligro ? "peligro" : "primario"}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmar}
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
