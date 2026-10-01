/**
 * Captura de metadatos para los reportes de incidencias. El navegador se
 * simula (userAgent, pantalla, ventana, URL); lo que importa es qué se lee
 * y, sobre todo, qué NO viaja (tokens en el query, el hash).
 */
import {
  capturarContexto,
  detectarNavegador,
  detectarSistemaOperativo,
  rutaSegura,
} from "@/lib/contexto-reporte";

const UA = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

describe("detectarNavegador", () => {
  it.each([
    [UA.chromeWindows, "Chrome 126"],
    [UA.edge, "Edge 126"], // dice "Chrome" también: gana Edge
    [UA.firefoxLinux, "Firefox 127"],
    [UA.safariMac, "Safari 17"],
    [UA.chromeAndroid, "Chrome 126"],
    [UA.safariIphone, "Safari 17"],
    ["algo raro", "Desconocido"],
  ])("%s", (ua, esperado) => {
    expect(detectarNavegador(ua)).toBe(esperado);
  });
});

describe("detectarSistemaOperativo", () => {
  it.each([
    [UA.chromeWindows, "Windows"],
    [UA.firefoxLinux, "Linux"],
    [UA.safariMac, "macOS"],
    [UA.chromeAndroid, "Android 14"],
    [UA.safariIphone, "iOS"],
    ["algo raro", "Desconocido"],
  ])("%s", (ua, esperado) => {
    expect(detectarSistemaOperativo(ua)).toBe(esperado);
  });

  it("un iPad se hace pasar por Mac: se reconoce por la pantalla táctil", () => {
    expect(detectarSistemaOperativo(UA.safariMac, 5)).toBe("iPadOS");
    expect(detectarSistemaOperativo(UA.safariMac, 0)).toBe("macOS");
  });
});

describe("rutaSegura", () => {
  it("deja la ruta y el query normales", () => {
    expect(rutaSegura("/conversaciones", "?canal=whatsapp&pagina=2")).toBe(
      "/conversaciones?canal=whatsapp&pagina=2",
    );
  });

  it("quita códigos y tokens del query", () => {
    expect(
      rutaSegura("/conectar", "?code=ABC123&state=xyz&access_token=secreto&canal=meta"),
    ).toBe("/conectar?canal=meta");
  });

  it("sin query devuelve solo la ruta", () => {
    expect(rutaSegura("/dashboard", "")).toBe("/dashboard");
    expect(rutaSegura("/conectar", "?code=ABC")).toBe("/conectar");
  });
});

describe("capturarContexto", () => {
  const original = { ua: navigator.userAgent, ancho: window.innerWidth, alto: window.innerHeight };

  beforeEach(() => {
    Object.defineProperty(navigator, "userAgent", { value: UA.chromeWindows, configurable: true });
    Object.defineProperty(navigator, "language", { value: "es-MX", configurable: true });
    Object.defineProperty(window.screen, "width", { value: 1920, configurable: true });
    Object.defineProperty(window.screen, "height", { value: 1080, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 720, configurable: true });
    window.history.pushState({}, "", "/calendario?semana=3&token=secreto#seccion-privada");
  });

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", { value: original.ua, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: original.ancho, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: original.alto, configurable: true });
  });

  it("lee ruta, navegador, sistema operativo y resolución", () => {
    const c = capturarContexto();

    expect(c.ruta).toBe("/calendario?semana=3");
    expect(c.navegador).toBe("Chrome 126");
    expect(c.sistema_operativo).toBe("Windows");
    expect(c.user_agent).toBe(UA.chromeWindows);
    expect(c.idioma).toBe("es-MX");
    expect(c.pantalla).toEqual({ ancho: 1920, alto: 1080 });
    expect(c.ventana).toEqual({ ancho: 1280, alto: 720 });
    expect(typeof c.zona_horaria).toBe("string");
  });

  it("no incluye el hash ni el token de la URL", () => {
    const serializado = JSON.stringify(capturarContexto());

    expect(serializado).not.toContain("secreto");
    expect(serializado).not.toContain("seccion-privada");
  });
});
