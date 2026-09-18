import "@testing-library/jest-dom";

// Recharts (ResponsiveContainer) crea un ResizeObserver al montarse.
// jsdom no lo implementa: sin este polyfill, cualquier gráfico truena al
// renderizar con "ResizeObserver is not defined".
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

// jsdom trae `Blob` pero no `URL.createObjectURL`/`revokeObjectURL` (lanzan
// "is not a function"). Lo necesita cualquier test que llegue a
// descargarArchivo() (lib/descargar-archivo.ts) sin mockearla directamente.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = jest.fn(() => "blob:mock-url");
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = jest.fn();
}

// jsdom no hace layout real: ResponsiveContainer siempre mide 0x0 y
// Recharts lo advierte en cada render. Es ruido esperado, no una falla.
const advertenciaOriginal = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("width(0) and height(0)")) {
    return;
  }
  advertenciaOriginal(...args);
};

// next/dynamic (ui.tsx envuelve CentroNotificaciones así) hace una
// actualización de estado interna propia, fuera del control de RTL, un
// tick después de que el test termina su render. No es un bug de la
// página bajo prueba, así que solo se silencia ESE mensaje puntual — el
// resto de los warnings de "not wrapped in act" se siguen viendo.
const errorOriginal = console.error;
console.error = (...args: unknown[]) => {
  const textoCompleto = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
  if (textoCompleto.includes("not wrapped in act") && textoCompleto.includes("LoadableComponent")) {
    return;
  }
  errorOriginal(...args);
};
