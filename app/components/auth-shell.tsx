import type { ReactNode } from "react";
import Image from "next/image";

/** Fondo con banner + tarjeta centrada. Compartido por /login y /registro. */
export function AuthShell({
  titulo,
  sub,
  children,
  pie,
}: {
  titulo: string;
  sub: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-y-auto p-4">
      <Image
        src="/imagenes/banner_login.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-bg-950/40" />

      <div className="relative z-10 my-auto w-full max-w-sm rounded-2xl border border-bg-700 bg-bg-900/90 p-8 shadow-xl backdrop-blur-md">
        <Image
          src="/imagenes/LOGO_OPERATIVAI.png"
          alt="OperativAI"
          width={240}
          height={64}
          className="h-auto w-36"
          priority
        />
        <h1 className="mt-5 text-2xl font-medium text-text-100">{titulo}</h1>
        <p className="mt-1 text-sm text-text-400">{sub}</p>

        {children}

        {pie && <div className="mt-6 text-center text-xs text-text-400">{pie}</div>}
      </div>
    </div>
  );
}
