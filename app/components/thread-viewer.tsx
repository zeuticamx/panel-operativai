import type { MensajeOut } from "@/lib/types";
import { formatoFechaHora, formatoHora } from "@/lib/formato";
import { MessageBubble } from "./message-bubble";
import { AdjuntoMensaje } from "./adjunto-mensaje";

const ETIQUETA_AUTOMATICA = /^\[(Imagen|Documento: .*)\]$/;

/** Clave de día local para agrupar mensajes con un separador de fecha. */
function claveDia(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function etiquetaDia(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ThreadViewer({
  mensajes,
  nombreAgente = "Agente",
  nombreCliente = "Cliente",
  adjuntoUrl,
}: {
  mensajes: MensajeOut[];
  nombreAgente?: string;
  nombreCliente?: string;
  /** Ruta autenticada de un adjunto del hilo, dado su id. */
  adjuntoUrl?: (adjuntoId: string) => string;
}) {
  if (mensajes.length === 0) {
    return (
      <div className="py-12 text-center font-mono text-xs text-text-600">
        sin mensajes en esta conversación
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mensajes.map((m, i) => {
        const dia = claveDia(m.created_at);
        const nuevoDia = i === 0 || dia !== claveDia(mensajes[i - 1].created_at);

        return (
          <div key={m.id} className="flex flex-col gap-3">
            {nuevoDia && (
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-bg-700" />
                <span className="font-mono text-[11px] text-text-600 first-letter:uppercase">
                  {etiquetaDia(m.created_at)}
                </span>
                <span className="h-px flex-1 bg-bg-700" />
              </div>
            )}
            <MessageBubble
              role={m.role}
              timestamp={formatoHora(m.created_at)}
              meta={
                m.role === "assistant"
                  ? nombreAgente
                  : m.role === "user"
                    ? nombreCliente
                    : m.role === "human"
                      ? m.enviado_por || "Equipo"
                      : m.role
              }
            >
              {adjuntoUrl &&
                (m.adjuntos ?? []).map((a) => (
                  <div key={a.id} className="mb-1.5 last:mb-0">
                    <AdjuntoMensaje adjunto={a} url={adjuntoUrl(a.id)} />
                  </div>
                ))}
              {/* Con archivo, la etiqueta automática ("[Imagen]") sobra: solo
                  se muestra una leyenda escrita de verdad. */}
              {!(
                adjuntoUrl &&
                m.adjuntos?.length &&
                (ETIQUETA_AUTOMATICA.test(m.content) || m.adjuntos.some((a) => a.nombre === m.content))
              ) && (
                <span title={formatoFechaHora(m.created_at)}>{m.content}</span>
              )}
            </MessageBubble>
          </div>
        );
      })}
    </div>
  );
}
