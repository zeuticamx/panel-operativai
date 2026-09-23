import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones del servicio — OperativAI",
  description:
    "Condiciones del servicio del portal OperativAI: uso de la cuenta, de los canales y del agente de IA.",
};

export default function CondicionesPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-950 text-text-100">
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <Link href="/login" className="text-sm text-text-400 underline-offset-2 hover:text-text-100 hover:underline">
          ← Volver al inicio de sesión
        </Link>

        <p className="mt-8 font-mono text-xs tracking-widest text-text-600 uppercase">Legal</p>
        <h1 className="mt-3 text-3xl font-medium">Condiciones del servicio</h1>
        <p className="mt-2 text-sm text-text-400">Última actualización: 23 de septiembre de 2026</p>

        <p className="mt-8 text-sm leading-7 text-text-400">
          Estas condiciones regulan el uso del portal de OperativAI, donde administras el agente de IA
          de tu negocio. El texto vigente para el sitio público está en{" "}
          <a
            href="https://www.operativai.com.mx/condiciones"
            className="text-text-100 underline underline-offset-2"
          >
            operativai.com.mx/condiciones
          </a>
          . Si no estás de acuerdo, no uses el portal.
        </p>

        <h2 className="mt-10 text-lg font-medium">1. La cuenta</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Eres responsable de los datos de tu negocio, de custodiar tu contraseña y de lo que se haga
          desde tu sesión. Puedes entrar con correo y contraseña o con Google. Con Google solo usamos
          tu nombre, tu correo y el identificador de la cuenta para reconocerte. No pedimos acceso a
          Gmail, Calendar ni Drive.
        </p>

        <h2 className="mt-10 text-lg font-medium">2. Canales</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Si conectas WhatsApp, Facebook o Instagram, declaras que tienes facultad para operar ese
          canal y que el uso cumple las reglas de esa plataforma.
        </p>

        <h2 className="mt-10 text-lg font-medium">3. Uso aceptable</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-text-400">
          <li>No envíes mensajes a quien no haya dado su consentimiento.</li>
          <li>No suplantes a otra persona o empresa.</li>
          <li>No uses el agente para fraude ni para actividad ilegal.</li>
        </ul>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Podemos suspender el acceso si el uso pone en riesgo a otras personas o al servicio.
        </p>

        <h2 className="mt-10 text-lg font-medium">4. Resultados y datos</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          El agente responde con la información y las reglas que configuras. No garantizamos un volumen
          de ventas. Tus conversaciones y la configuración de tu negocio siguen siendo tuyos. El
          tratamiento de datos personales está en la{" "}
          <Link href="/privacidad" className="text-text-100 underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>

        <h2 className="mt-10 text-lg font-medium">5. Ley aplicable</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Estas condiciones se rigen por las leyes de México. Para cualquier controversia son
          competentes los tribunales de Guadalajara, Jalisco.
        </p>

        <p className="mt-12 text-xs text-text-600">© 2026 OperativAI. Guadalajara, México.</p>
      </div>
    </main>
  );
}
