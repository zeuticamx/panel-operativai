"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { EstadoInstagramNeuroApiOut, IniciarNeuroApiConnectOut } from "@/lib/types";
import { CanalIcon } from "@/app/components/status";
import { Aviso, Boton } from "@/app/components/ui";

const INTERVALO_RETORNO_MS = 3_000;
const ESPERA_RETORNO_MS = 90_000;

/**
 * "Vincular Instagram Direct": abre una NeuroAPI Connect Session y manda al
 * negocio a Meta para que autorice su cuenta profesional. Volverá a
 * `/canales?instagram_neuroapi=retorno` (ver `RetornoInstagram`).
 */
export function BotonVincularInstagram({ onError }: { onError: (mensaje: string) => void }) {
  const [iniciando, setIniciando] = useState(false);

  const iniciar = async () => {
    setIniciando(true);
    try {
      const datos = await apiFetch<IniciarNeuroApiConnectOut>("/api/canales/instagram/neuroapi/iniciar", {
        method: "POST",
      });
      // .assign() y no `.href`: la regla react-hooks/immutability de
      // eslint-config-next 16 prohíbe asignarle a window.location.
      window.location.assign(datos.connect_url);
    } catch (e) {
      onError(mensajeDeError(e, "No se pudo iniciar la vinculación con Instagram."));
      setIniciando(false);
    }
  };

  return (
    <Boton variante="primario" onClick={iniciar} loading={iniciando}>
      <CanalIcon tipo="instagram" size={13} />
      Vincular Instagram Direct
    </Boton>
  );
}

const MENSAJE_CODIGO: Record<string, string> = {
  cuenta_instagram_no_encontrada: "No se pudo vincular esa cuenta de Instagram.",
  cuenta_instagram_no_valida: "Meta no devolvió una cuenta de Instagram válida. Vuelve a intentarlo.",
  demasiados_intentos: "Demasiados intentos de vincular cuentas. Inténtalo de nuevo más tarde.",
};

/**
 * Retorno de Meta. Llegar aquí (aunque traiga `?status=success`) no significa
 * que la cuenta ya esté vinculada: lo decide el webhook, que suele llegar
 * DESPUÉS que el navegador. Se consulta la última sesión de Instagram del
 * negocio hasta que deje de estar pendiente o se agote la espera.
 */
export function RetornoInstagram({ onVinculado }: { onVinculado: () => void }) {
  const params = useSearchParams();
  const retorno = params.get("instagram_neuroapi") === "retorno";
  // NeuroAPI agrega `status`; solo un valor distinto de "success" se toma en
  // cuenta, para avisar enseguida de que el negocio canceló en Meta.
  const statusRetorno = params.get("status");
  const cancelado = retorno && statusRetorno !== null && statusRetorno !== "success";

  // Con el session_id del retorno se consulta esa sesión; sin él, la última.
  const sessionId = params.get("session_id");
  const sesion = useApi<EstadoInstagramNeuroApiOut>(
    retorno && !cancelado
      ? `/api/canales/instagram/neuroapi/estado${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`
      : null,
  );
  const [esperaAgotada, setEsperaAgotada] = useState(false);
  const pendiente = !sesion.data || sesion.data.estado === "pendiente";
  const recargar = sesion.recargar;

  useEffect(() => {
    if (!retorno || cancelado || !pendiente) return;
    const intervalo = setInterval(() => void recargar(true), INTERVALO_RETORNO_MS);
    const limite = setTimeout(() => {
      clearInterval(intervalo);
      setEsperaAgotada(true);
    }, ESPERA_RETORNO_MS);
    return () => {
      clearInterval(intervalo);
      clearTimeout(limite);
    };
  }, [retorno, cancelado, pendiente, recargar]);

  const vinculado = sesion.data?.estado === "completado" && sesion.data.resultado === "vinculado";
  useEffect(() => {
    if (vinculado) onVinculado();
  }, [vinculado, onVinculado]);

  if (!retorno) return null;

  if (cancelado) {
    return (
      <Aviso tipo="error">
        No se completó la autorización de Instagram en Meta. Vuelve a intentarlo cuando quieras.
      </Aviso>
    );
  }

  const datos = sesion.data;
  if (datos && datos.estado !== "pendiente") {
    if (datos.resultado === "vinculado") {
      return (
        <Aviso tipo="exito">
          Instagram vinculado{datos.username ? ` (@${datos.username})` : ""}. Tu agente ya responde los
          mensajes directos.
        </Aviso>
      );
    }
    if (datos.resultado === "propio") {
      return <Aviso tipo="info">Esa cuenta de Instagram ya estaba vinculada a tu negocio.</Aviso>;
    }
    return (
      <Aviso tipo="error">
        {(datos.codigo && MENSAJE_CODIGO[datos.codigo]) ??
          "La vinculación de Instagram no se completó. Vuelve a intentarlo."}
      </Aviso>
    );
  }

  if (esperaAgotada) {
    return (
      <Aviso tipo="error">
        No recibimos la confirmación de Instagram. Recarga la página o vuelve a intentarlo.
      </Aviso>
    );
  }
  return <Aviso tipo="info">Estamos terminando de vincular tu Instagram. Esto puede tardar unos segundos.</Aviso>;
}
