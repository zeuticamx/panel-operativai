import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Eliminación de datos — Orvia",
  description:
    "Instrucciones para solicitar la eliminación de los datos que Orvia conserva a través de tu cuenta de Meta (Facebook, Instagram o WhatsApp).",
};

export default function EliminacionDatosPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-bg-950 text-text-100">
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <Link href="/login" className="text-sm text-text-400 underline-offset-2 hover:text-text-100 hover:underline">
          ← Volver al inicio de sesión
        </Link>

        <p className="mt-8 font-mono text-xs tracking-widest text-text-600 uppercase">Legal</p>
        <h1 className="mt-3 text-3xl font-medium">Eliminación de datos</h1>
        <p className="mt-2 text-sm text-text-400">Última actualización: 23 de octubre de 2026</p>

        <p className="mt-8 text-sm leading-7 text-text-400">
          Esta página explica cómo pedir que eliminemos los datos que Orvia conserva a través de
          tu cuenta de Meta (Facebook, Instagram o WhatsApp), ya sea porque conectaste un canal como
          dueño de un negocio o porque escribiste a un negocio que usa Orvia. Revocar el acceso
          de la app desde tu configuración de Facebook detiene el envío de mensajes, pero no borra por
          sí solo lo ya guardado: para eso, sigue los pasos de abajo.
        </p>

        <h2 className="mt-10 text-lg font-medium">1. Si eres dueño de un negocio</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Al conectar Facebook, Instagram o WhatsApp a tu cuenta de Orvia guardamos el
          identificador de esa conexión, el token de acceso y, mientras el canal esté activo, las
          conversaciones de tus clientes. Puedes desconectar un canal tú mismo desde{" "}
          <span className="font-mono text-text-100">Canales</span> en el portal; eso desactiva el
          envío y la recepción de mensajes por ese canal de inmediato.
        </p>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Para pedir que además eliminemos el token guardado y el historial de conversaciones de ese
          canal, escríbenos (ver sección 3) indicando el nombre de tu negocio y el canal del que
          quieres borrar los datos.
        </p>

        <h2 className="mt-10 text-lg font-medium">2. Si eres cliente de un negocio que usa Orvia</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Si le escribiste a un negocio por WhatsApp, Messenger o Instagram y ese negocio usa
          Orvia, guardamos los mensajes de esa conversación para que el negocio y su agente de IA
          puedan atenderte. Revocar el acceso de la app desde tu cuenta de Meta no borra esa
          conversación: escríbenos directamente (ver sección 3) indicando el número o cuenta desde la
          que escribiste y el negocio al que le escribiste, para localizar y eliminar tus datos.
        </p>

        <h2 className="mt-10 text-lg font-medium">3. Cómo solicitarlo</h2>
        <p className="mt-3 text-sm leading-7 text-text-400">
          Envía tu solicitud por el formulario de contacto de{" "}
          <a
            href="https://www.orvia.tech/#demo"
            className="text-text-100 underline underline-offset-2"
          >
            orvia.tech
          </a>{" "}
          o por escrito al domicilio del responsable (Felipe Osvaldo Ruvalcaba Ayala, Calle Blvd de los Charros número 1629, colonia Belenes Norte, C.P. 45145, Zapopan, Jalisco, México),
          indicando qué datos quieres eliminar y un medio para responderte. Atendemos la solicitud
          dentro de 20 días hábiles, el mismo plazo que aplica a los demás derechos ARCO descritos en
          nuestro{" "}
          <Link href="/privacidad" className="text-text-100 underline underline-offset-2">
            aviso de privacidad
          </Link>
          .
        </p>

        <p className="mt-12 text-xs text-text-600">© 2026 Orvia. Zapopan, Jalisco, México.</p>
      </div>
    </main>
  );
}
