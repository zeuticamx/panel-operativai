import type { NextConfig } from "next";

const esProduccion = process.env.NODE_ENV === "production";

/** Origen (esquema + host + puerto) de una URL, o null si no es válida/está vacía. */
function origenDe(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const origenApi = origenDe(process.env.NEXT_PUBLIC_API_URL);
const origenChat = origenDe(process.env.NEXT_PUBLIC_CHAT_IFRAME_URL);

// connect-src: el API (fetch + socket.io por ws/wss). En desarrollo también el
// backend local y el proxy HTTPS de `npm run dev:https` (lib/auth.ts).
const origenesApi = [
  ...new Set(
    [
      origenApi,
      origenApi?.replace(/^http/, "ws"),
      ...(esProduccion
        ? []
        : [
            "http://localhost:8000",
            "ws://localhost:8000",
            "https://localhost:8443",
            "wss://localhost:8443",
          ]),
    ].filter((o): o is string => Boolean(o)),
  ),
];

const GOOGLE = "https://accounts.google.com"; // Sign-In: script, iframe, estilos y XHR

const directivas = (...partes: (string | false | null)[]) =>
  partes.filter(Boolean).join("; ");

/**
 * Política completa. Va en modo Report-Only: no bloquea nada, las violaciones
 * aparecen en la consola del navegador. Pasar a `Content-Security-Policy` cuando
 * se confirme que no hay ruido en login Google, Meta OAuth, websockets y chat.
 */
const cspCompleta = directivas(
  "default-src 'self'",
  // Next inyecta scripts inline sin nonce; 'unsafe-eval' solo para el HMR de dev.
  `script-src 'self' 'unsafe-inline' ${esProduccion ? "" : "'unsafe-eval' "}${GOOGLE}`,
  `style-src 'self' 'unsafe-inline' ${GOOGLE}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${origenesApi.join(" ")} ${GOOGLE}`,
  `frame-src ${GOOGLE}${origenChat ? ` ${origenChat}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
);

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: cspCompleta },
  // Parte de la CSP que sí se aplica ya: el portal no debe ir dentro de un iframe.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Sin Cross-Origin-Opener-Policy a propósito: el popup de Meta y el de Google
  // se comunican con la ventana que los abrió (window.opener / postMessage).
  ...(esProduccion
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Hay un package-lock.json suelto en el home del usuario; sin esto Next
  // cree que la raíz del workspace es C:\Users\Usuario.
  outputFileTracingRoot: import.meta.dirname,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Proxy del API por el propio portal (spec 006): con NEXT_PUBLIC_API_PROXY
  // el navegador llama a `/api/*` del mismo origen del portal y Next lo
  // reenvía al backend. Así la cookie `op_refresh` es de primera parte (no la
  // bloquean Safari ni el bloqueo de cookies de terceros) y se puede usar
  // SameSite=Lax. El destino se hornea en el build, igual que NEXT_PUBLIC_API_URL.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_PROXY !== "true" || !origenApi) return [];
    return [{ source: "/api/:path*", destination: `${origenApi}/api/:path*` }];
  },
};

export default nextConfig;
