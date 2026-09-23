import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso de privacidad — OperativAI",
  description:
    "Aviso de privacidad del portal OperativAI: qué datos recabamos al crear tu cuenta, al entrar con Google y al usar el agente, y cómo ejercer tus derechos ARCO.",
};

export default function PrivacidadPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-950 text-text-100">
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <Link href="/login" className="text-sm text-text-400 underline-offset-2 hover:text-text-100 hover:underline">
          ← Volver al inicio de sesión
        </Link>

        <p className="mt-8 font-mono text-xs tracking-widest text-text-600 uppercase">Legal</p>
        <h1 className="mt-3 text-3xl font-medium">Aviso de privacidad</h1>
        <p className="mt-2 text-sm text-text-400">Última actualización: 23 de septiembre de 2026</p>

        <p className="mt-8 text-sm leading-7 text-text-400">
          OperativAI es el portal donde administras el agente de IA de tu negocio: conversaciones,
          canales conectados (WhatsApp, Facebook e Instagram) y la configuración del agente. Este
          aviso describe los datos personales que recabamos en este portal.
        </p>

        <h2 className="mt-10 text-lg font-medium">1. Datos personales que recabamos</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">Al crear tu cuenta o usar el portal recabamos:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-text-400">
          <li>Nombre del negocio y, si lo indicas, tu nombre.</li>
          <li>Correo electrónico y contraseña. La contraseña se guarda cifrada; no la vemos en claro.</li>
          <li>El código de verificación que te enviamos para confirmar el correo.</li>
          <li>
            Si eliges «Continuar con Google», recibimos de Google únicamente el identificador de tu
            cuenta, tu nombre y tu correo, para crear o iniciar tu sesión. No pedimos acceso a Gmail,
            Calendar, Drive ni a ningún otro dato de tu cuenta de Google.
          </li>
          <li>
            Si conectas un canal de Meta (Facebook, Instagram o WhatsApp), los identificadores de esa
            conexión y los mensajes que el agente atiende, para prestar el servicio.
          </li>
          <li>La configuración que guardes del agente y el registro de uso del portal.</li>
        </ul>
        <p className="mt-3 text-sm leading-7 text-text-400">
          No recabamos datos personales sensibles a través de este portal.
        </p>

        <h2 className="mt-10 text-lg font-medium">2. Finalidades del tratamiento</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7 text-text-400">
          <li>Crear tu cuenta y autenticarte, incluso cuando entras con Google.</li>
          <li>Operar el agente de IA, sus conversaciones y los canales que conectes.</li>
          <li>Administrar tu suscripción y el equipo de tu negocio.</li>
          <li>Atender solicitudes sobre tu cuenta y la seguridad del servicio.</li>
        </ul>

        <h2 className="mt-10 text-lg font-medium">3. Transferencias</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          No vendemos tus datos. Los tratamos con proveedores que operan el servicio por nuestra
          cuenta: Google, solo para el inicio de sesión con tu cuenta de Google; Meta, solo si conectas
          un canal; y la infraestructura donde corre este portal. Esos proveedores pueden almacenar
          información en servidores fuera de México.
        </p>

        <h2 className="mt-10 text-lg font-medium">4. Derechos ARCO</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos, y revocar tu
          consentimiento. Envía tu solicitud por el formulario de contacto de{" "}
          <a
            href="https://www.operativai.com.mx/#demo"
            className="text-text-100 underline underline-offset-2"
          >
            operativai.com.mx
          </a>{" "}
          indicando tu nombre, el derecho que quieres ejercer y un medio para responderte. El plazo de
          respuesta es de 20 días hábiles.
        </p>

        <h2 className="mt-10 text-lg font-medium">5. Conservación</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Conservamos los datos mientras la cuenta esté activa y, después, por los plazos que exijan
          la legislación fiscal y mercantil. Concluido ese periodo, se eliminan.
        </p>

        <h2 className="mt-10 text-lg font-medium">6. Cookies</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          El portal guarda en tu navegador los tokens de sesión necesarios para mantenerte dentro de
          tu cuenta. No usamos cookies de publicidad. Si entras con Google, Google puede instalar sus
          propias cookies al mostrar el botón de acceso; ese tratamiento lo rige la política de Google.
        </p>

        <h2 className="mt-10 text-lg font-medium">7. Cambios</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Cualquier cambio a este aviso se publica en esta misma página, con la fecha de actualización.
        </p>

        <h2 className="mt-10 text-lg font-medium">8. Autoridad</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir al INAI en{" "}
          <a href="https://home.inai.org.mx/" className="text-text-100 underline underline-offset-2" rel="noopener">
            home.inai.org.mx
          </a>
          .
        </p>

        <p className="mt-12 text-xs text-text-600">© 2026 OperativAI. Guadalajara, México.</p>
      </div>
    </main>
  );
}
