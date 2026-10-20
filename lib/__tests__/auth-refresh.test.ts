/**
 * Refresh por cookie HttpOnly (spec 006): apiFetch ya no lee ni escribe el
 * refresh token en localStorage. /auth/refresh viaja con `credentials:
 * "include"` y, salvo que quede un refresh de un cliente viejo, con el
 * cuerpo vacío — la cookie la manda el navegador solo.
 *
 * URL de jsdom fijada en /login (ver @jest-environment-options abajo): así
 * el caso de "el refresh también falla" no dispara el
 * `window.location.replace` de irALogin (ya está "en /login"), que jsdom
 * no deja mockear reemplazando el objeto `location`.
 *
 * @jest-environment-options {"url": "http://localhost/login"}
 */
import { apiFetch, clearTokens, getAccessToken, setTokens } from "@/lib/auth";

const ACCESS_KEY = "operativai_access_token";
const REFRESH_KEY_LEGACY = "operativai_refresh_token";

function mockFetchSecuencia(respuestas: Array<{ url: RegExp; status: number; cuerpo: unknown }>) {
  const llamadas: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), init });
    const match = respuestas.find((r) => r.url.test(String(url)));
    if (!match) throw new Error(`Sin mock para ${url}`);
    return Promise.resolve({
      status: match.status,
      ok: match.status >= 200 && match.status < 300,
      text: async () => JSON.stringify(match.cuerpo),
    } as unknown as Response);
  }) as unknown as typeof fetch;
  return llamadas;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("setTokens / clearTokens (spec 006: sin refresh en localStorage)", () => {
  it("setTokens solo guarda el access token", () => {
    setTokens({ access_token: "abc" });
    expect(getAccessToken()).toBe("abc");
    expect(window.localStorage.getItem(REFRESH_KEY_LEGACY)).toBeNull();
  });

  it("clearTokens limpia storage y llama a /auth/logout sin esperarlo", () => {
    window.localStorage.setItem(ACCESS_KEY, "abc");
    const llamadas = mockFetchSecuencia([{ url: /\/auth\/logout$/, status: 204, cuerpo: null }]);

    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(llamadas[0]?.url).toContain("/api/auth/logout");
    expect(llamadas[0]?.init?.credentials).toBe("include");
  });
});

describe("apiFetch: refresco automático ante un 401", () => {
  it("401 -> refresca por cookie (sin body) -> reintenta y devuelve el dato", async () => {
    window.localStorage.setItem(ACCESS_KEY, "viejo");

    const llamadas: Array<{ url: string; init?: RequestInit }> = [];
    let llamadaApiN = 0;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      llamadas.push({ url: String(url), init });
      if (/\/auth\/refresh$/.test(String(url))) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: async () => ({ access_token: "nuevo", refresh_token: null }),
          text: async () => JSON.stringify({ access_token: "nuevo", refresh_token: null }),
        } as Response);
      }
      llamadaApiN += 1;
      if (llamadaApiN === 1) {
        return Promise.resolve({ status: 401, ok: false, text: async () => JSON.stringify({ detail: "x" }) } as Response);
      }
      return Promise.resolve({ status: 200, ok: true, text: async () => JSON.stringify({ ok: true }) } as Response);
    }) as unknown as typeof fetch;

    const data = await apiFetch<{ ok: boolean }>("/api/algo");

    expect(data).toEqual({ ok: true });
    expect(getAccessToken()).toBe("nuevo");

    const refreshCall = llamadas.find((l) => l.url.includes("/auth/refresh"));
    expect(refreshCall?.init?.credentials).toBe("include");
    expect(refreshCall?.init?.body).toBe("{}");
  });

  it("refresh con un refresh_token viejo en localStorage lo manda una sola vez y lo borra", async () => {
    window.localStorage.setItem(ACCESS_KEY, "viejo");
    window.localStorage.setItem(REFRESH_KEY_LEGACY, "refresh-viejo");

    const llamadas: Array<{ url: string; init?: RequestInit }> = [];
    let llamadaApiN = 0;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      llamadas.push({ url: String(url), init });
      if (/\/auth\/refresh$/.test(String(url))) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: async () => ({ access_token: "nuevo", refresh_token: null }),
          text: async () => JSON.stringify({ access_token: "nuevo", refresh_token: null }),
        } as Response);
      }
      llamadaApiN += 1;
      if (llamadaApiN === 1) {
        return Promise.resolve({ status: 401, ok: false, text: async () => JSON.stringify({ detail: "x" }) } as Response);
      }
      return Promise.resolve({ status: 200, ok: true, text: async () => "{}" } as Response);
    }) as unknown as typeof fetch;

    await apiFetch("/api/algo");

    const refreshCall = llamadas.find((l) => l.url.includes("/auth/refresh"));
    expect(refreshCall?.init?.body).toBe(JSON.stringify({ refresh_token: "refresh-viejo" }));
    // Se borró: un segundo refresh ya no lo manda.
    expect(window.localStorage.getItem(REFRESH_KEY_LEGACY)).toBeNull();
  });

  it("si el refresh también falla, limpia tokens y pide volver a /login", async () => {
    window.localStorage.setItem(ACCESS_KEY, "viejo");
    global.fetch = jest.fn((url: string) => {
      if (/\/auth\/refresh$/.test(String(url))) {
        return Promise.resolve({ status: 401, ok: false, text: async () => "{}" } as Response);
      }
      if (/\/auth\/logout$/.test(String(url))) {
        return Promise.resolve({ status: 204, ok: true, text: async () => "" } as Response);
      }
      return Promise.resolve({ status: 401, ok: false, text: async () => JSON.stringify({ detail: "x" }) } as Response);
    }) as unknown as typeof fetch;

    await expect(apiFetch("/api/algo")).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});

describe("NEXT_PUBLIC_API_PROXY (portal como proxy del API)", () => {
  const original = process.env.NEXT_PUBLIC_API_PROXY;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_API_PROXY;
    else process.env.NEXT_PUBLIC_API_PROXY = original;
    jest.resetModules();
  });

  it("con la bandera, las peticiones HTTP van a rutas relativas y los sockets siguen directos", async () => {
    process.env.NEXT_PUBLIC_API_PROXY = "true";
    jest.resetModules();
    const auth = await import("@/lib/auth");
    expect(auth.API_HTTP_URL).toBe("");
    expect(auth.API_URL).toMatch(/^https?:\/\//);

    const llamadas: string[] = [];
    global.fetch = jest.fn((url: string) => {
      llamadas.push(String(url));
      return Promise.resolve({ status: 200, ok: true, text: async () => "{}" } as Response);
    }) as unknown as typeof fetch;
    await auth.apiFetch("/api/algo");
    expect(llamadas[0]).toBe("/api/algo");
  });

  it("sin la bandera, llama directo al backend", async () => {
    delete process.env.NEXT_PUBLIC_API_PROXY;
    jest.resetModules();
    const auth = await import("@/lib/auth");
    expect(auth.API_HTTP_URL).toBe(auth.API_URL);
  });
});
