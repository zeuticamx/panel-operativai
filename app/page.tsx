"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";

/** La raíz solo decide a dónde mandar: dashboard si hay sesión, login si no. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getAccessToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center font-mono text-xs text-text-600">
      cargando…
    </div>
  );
}
