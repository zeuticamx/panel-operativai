import { conGiro, debeIrABienvenida, respuestasIniciales } from "@/lib/onboarding";

describe("debeIrABienvenida", () => {
  const pendiente = { onboarding_pendiente: true, impersonado_por: null };

  it("manda al cuestionario al aterrizar en el dashboard con el onboarding pendiente", () => {
    expect(debeIrABienvenida(pendiente, "/dashboard", false)).toBe(true);
  });

  it("una sola vez por pestaña: es omitible", () => {
    expect(debeIrABienvenida(pendiente, "/dashboard", true)).toBe(false);
  });

  it("no interrumpe otras pantallas", () => {
    expect(debeIrABienvenida(pendiente, "/conversaciones", false)).toBe(false);
  });

  it("nunca en ver-como ni sin onboarding pendiente", () => {
    expect(debeIrABienvenida({ onboarding_pendiente: true, impersonado_por: "soporte@x" }, "/dashboard", false)).toBe(
      false,
    );
    expect(debeIrABienvenida({ onboarding_pendiente: false }, "/dashboard", false)).toBe(false);
    expect(debeIrABienvenida(null, "/dashboard", false)).toBe(false);
  });
});

describe("conGiro", () => {
  it("marca los valores típicos del giro sin tocar lo demás", () => {
    const base = { ...respuestasIniciales(), horario: "9 a 18", num_vendedores: 3 };

    const salon = conGiro(base, "salon_belleza");
    expect(salon).toMatchObject({ giro: "salon_belleza", agenda_citas: true, vende_por_chat: false });
    expect(salon.horario).toBe("9 a 18");
    expect(salon.num_vendedores).toBe(3);

    expect(conGiro(salon, "inmobiliaria")).toMatchObject({ agenda_citas: false, vende_por_chat: true });
  });
});
