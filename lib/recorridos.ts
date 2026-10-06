/**
 * Recorridos guiados por vista. Cada paso apunta a un elemento marcado con
 * `data-tour="<ancla>"`; sin `ancla` el paso se muestra como tarjeta
 * centrada. Si el ancla no está en pantalla (módulo apagado, estado vacío,
 * sidebar cerrado en móvil) el motor salta ese paso.
 *
 * La sección de plataforma (/gerencia/*) no tiene recorrido bajo ninguna
 * circunstancia: `recorridoParaRuta` la descarta antes de mirar el registro.
 */

export interface PasoRecorrido {
  ancla?: string;
  titulo: string;
  texto: string;
}

export interface Recorrido {
  /** Patrón de la ruta: segmentos dinámicos como `[id]`. Sirve de clave para "ya lo vio". */
  clave: string;
  pasos: PasoRecorrido[];
}

/** Rutas sin recorrido: redirecciones, documentos legales y el login. */
export const RUTAS_SIN_RECORRIDO = ["/", "/conectar/callback", "/condiciones", "/privacidad", "/login"];

/** Pantallas sin sesión con recorrido: el botón flota porque no tienen PageHeader. */
export const RUTAS_PUBLICAS = ["/registro", "/recuperar", "/invitacion"];

export function esRutaGerencia(pathname: string): boolean {
  return pathname === "/gerencia" || pathname.startsWith("/gerencia/");
}

const NAV: PasoRecorrido = {
  ancla: "nav.principal",
  titulo: "Menú principal",
  texto: "Desde aquí te mueves entre las secciones del portal.",
};
const NOTIFICACIONES: PasoRecorrido = {
  ancla: "pagina.notificaciones",
  titulo: "Notificaciones",
  texto: "La campana avisa en vivo de leads nuevos, reservas y clientes que piden hablar con una persona.",
};
const AYUDA: PasoRecorrido = {
  ancla: "pagina.ayuda",
  titulo: "¿Quieres repasarlo?",
  texto: "Con este botón vuelves a abrir el recorrido de esta página cuando quieras.",
};
const AYUDA_PUBLICA: PasoRecorrido = { ...AYUDA, ancla: "publico.ayuda" };

const intro = (titulo: string, texto: string): PasoRecorrido => ({ titulo, texto });

const PESTANAS_VENDEDORES: PasoRecorrido = {
  ancla: "pagina.secciones",
  titulo: "Secciones de ventas",
  texto: "Cambia entre el embudo, la cartera, la actividad del equipo, los reportes y la configuración.",
};
const PESTANAS_CALENDARIO: PasoRecorrido = {
  ancla: "pagina.secciones",
  titulo: "Secciones del calendario",
  texto: "Agenda del día, servicios, proveedores, corte diario y auditoría de cambios.",
};

const REGISTRO: Record<string, PasoRecorrido[]> = {
  "/dashboard": [
    intro("Tu panel", "Un vistazo rápido a cómo está trabajando tu agente de IA."),
    NAV,
    { ancla: "dashboard.metricas", titulo: "Indicadores", texto: "Conversaciones activas y volumen de mensajes de hoy y de los últimos 7 días." },
    { ancla: "dashboard.canales", titulo: "Por canal", texto: "Cuántas conversaciones llegan por WhatsApp, Instagram y Facebook." },
    { ancla: "dashboard.recientes", titulo: "Conversaciones recientes", texto: "Lo último que entró. Haz clic en una para abrir el chat completo." },
    { ancla: "pagina.acciones", titulo: "Actualizar", texto: "Vuelve a pedir los datos sin recargar la página." },
    NOTIFICACIONES,
    AYUDA,
  ],
  "/conversaciones": [
    intro("Conversaciones", "Los chats que atiende tu agente, en todos tus canales. Si eres proveedor de la agenda, ves los de tus clientes."),
    { ancla: "conversaciones.filtros", titulo: "Buscar y filtrar", texto: "Busca por nombre o número y filtra por canal o estado. «Transferidas a humano» muestra los chats que esperan a una persona." },
    { ancla: "conversaciones.lista", titulo: "Lista de chats", texto: "Cada fila muestra el último mensaje y cuánto queda de la ventana de 24 h de Meta. Haz clic para abrirla." },
    { ancla: "conversaciones.paginacion", titulo: "Más resultados", texto: "Avanza o retrocede entre páginas de conversaciones." },
    NOTIFICACIONES,
    AYUDA,
  ],
  "/conversaciones/[id]": [
    intro("Chat con tu cliente", "Aquí ves la conversación completa y puedes intervenir tú mismo."),
    { ancla: "conversacion.cabecera", titulo: "Cliente y estado", texto: "Quién es, por qué canal escribe, si lo atiende la IA o una persona, y cuánto queda de la ventana de 24 h." },
    { ancla: "conversacion.hilo", titulo: "Historial", texto: "Todos los mensajes del cliente, del agente y de tu equipo, en orden." },
    { ancla: "conversacion.composer", titulo: "Responder", texto: "Toma la conversación para escribirle tú, y devuélvesela a la IA cuando termines." },
    AYUDA,
  ],
  "/canales": [
    intro("Canales", "Conecta las cuentas donde responde tu agente."),
    { ancla: "canales.lista", titulo: "Tus canales", texto: "WhatsApp, Instagram y Facebook con su estado. Conecta o reconecta cada uno desde su fila." },
    { ancla: "pagina.acciones", titulo: "Actualizar estado", texto: "Vuelve a consultar si cada canal sigue conectado." },
    AYUDA,
  ],
  "/agente": [
    intro("Tu agente de IA", "Define cómo se presenta y cómo responde tu agente."),
    { ancla: "agente.identidad", titulo: "Identidad e instrucciones", texto: "El nombre del agente y el prompt con las reglas de tu negocio: qué ofrece, el tono y qué no debe decir." },
    { ancla: "agente.modelo", titulo: "Comportamiento", texto: "Activa o pausa el agente y ajusta el modelo, la creatividad y cuánto historial recuerda." },
    { ancla: "pagina.acciones", titulo: "Guardar cambios", texto: "Nada se aplica hasta que guardas. «Descartar» vuelve a la última versión guardada." },
    AYUDA,
  ],
  "/herramientas": [
    intro("Herramientas", "Acciones que tu agente puede ejecutar por sí mismo durante el chat."),
    { ancla: "pagina.acciones", titulo: "Agregar herramientas", texto: "Crea una herramienta nueva o consulta la documentación para conectarla." },
    { ancla: "herramientas.lista", titulo: "Tus herramientas", texto: "Actívalas, pausalas, edítalas o elimínalas desde cada fila." },
    { ancla: "herramientas.consumo", titulo: "Consumo de créditos", texto: "Cada uso descuenta un crédito. Aquí ves el detalle por fecha y herramienta." },
    AYUDA,
  ],
  "/vendedores": [
    intro("Embudo de ventas", "Sigue a cada lead desde que escribe hasta que compra."),
    PESTANAS_VENDEDORES,
    { ancla: "vendedores.embudo", titulo: "Embudo visual", texto: "Cuántos leads hay en cada etapa y cuánto tardan en avanzar." },
    { ancla: "vendedores.ranking", titulo: "Ranking del equipo", texto: "Qué vendedores están cerrando más." },
    { ancla: "vendedores.clientes", titulo: "Clientes en el embudo", texto: "Lista de leads: filtra, ábrelos y asígnalos a un vendedor." },
    AYUDA,
  ],
  "/vendedores/[id]": [
    intro("Ficha del vendedor", "El desempeño y la cartera de una persona de tu equipo."),
    { ancla: "vendedor.metricas", titulo: "Métricas", texto: "Sus leads, cierres y conversión." },
    { ancla: "vendedor.secciones", titulo: "Secciones", texto: "Cambia entre su cartera activa, sus últimos cierres y la bitácora completa." },
    AYUDA,
  ],
  "/vendedores/actividad": [
    intro("Actividad del equipo", "Qué hizo cada vendedor en campo."),
    PESTANAS_VENDEDORES,
    { ancla: "actividad.por-vendedor", titulo: "Actividad por vendedor", texto: "Visitas y movimientos de cada persona en el periodo." },
    { ancla: "actividad.visitas", titulo: "Visitas recientes", texto: "El detalle de las últimas visitas registradas." },
    AYUDA,
  ],
  "/vendedores/cartera": [
    intro("Cartera de campo", "Los negocios que tu equipo visita en persona."),
    PESTANAS_VENDEDORES,
    { ancla: "pagina.acciones", titulo: "Agregar clientes", texto: "Da de alta un cliente de campo nuevo." },
    { ancla: "cartera.lista", titulo: "Tu cartera", texto: "Busca, filtra y abre la ficha de cada cliente." },
    AYUDA,
  ],
  "/vendedores/configuracion": [
    intro("Configuración del embudo", "Ajusta las etapas por las que pasa un lead."),
    PESTANAS_VENDEDORES,
    { ancla: "configuracion.etapas", titulo: "Etapas", texto: "Crea, renombra y ordena las etapas de tu embudo." },
    { ancla: "configuracion.transiciones", titulo: "Transiciones", texto: "Define a qué etapa se puede pasar desde cada una." },
    AYUDA,
  ],
  "/vendedores/equipo": [
    intro("Tu equipo de ventas", "Quién vende y cómo se reparten los leads. Para apagar o encender este módulo, ve a Preferencias."),
    PESTANAS_VENDEDORES,
    { ancla: "equipo.reparto", titulo: "Reparto de leads", texto: "Cómo se asigna automáticamente cada lead nuevo." },
    { ancla: "equipo.lista", titulo: "Equipo", texto: "Agrega, edita o desactiva vendedores. Tu plan marca cuántos pueden estar activos a la vez." },
    { ancla: "equipo.lista", titulo: "Acceso a la app", texto: "Con «Dar acceso» le llega al vendedor un enlace para crear su propia contraseña. Entra a la app de vendedores y solo ve sus clientes." },
    AYUDA,
  ],
  "/vendedores/reportes": [
    intro("Reportes de ventas", "Gráficas del embudo para tomar decisiones."),
    PESTANAS_VENDEDORES,
    { ancla: "pagina.acciones", titulo: "Exportar", texto: "Descarga los reportes para compartirlos." },
    { ancla: "reportes.graficas", titulo: "Gráficas", texto: "Embudo por etapa, tendencia mensual, comparativa de vendedores y conversión." },
    AYUDA,
  ],
  "/calendario": [
    intro("Calendario", "Las citas que tu agente agenda por chat, y las que agregas tú."),
    PESTANAS_CALENDARIO,
    { ancla: "calendario.nueva", titulo: "Nueva reserva", texto: "Agenda a mano una cita que llegó por teléfono o en persona." },
    { ancla: "calendario.disponibilidad", titulo: "Tu disponibilidad", texto: "Marca tus descansos y días libres. Tu horario base lo fija el negocio." },
    { ancla: "calendario.metricas", titulo: "Resumen del día", texto: "Reservas, confirmadas, proveedores y servicios activos." },
    { ancla: "calendario.fecha", titulo: "Elegir día", texto: "Muévete entre días o vuelve a hoy." },
    { ancla: "calendario.agenda", titulo: "Agenda", texto: "Una columna por proveedor. Haz clic en una cita para ver su detalle, marcarla o cancelarla. Las que pasan sin marcarse quedan como «no asistió»; si sí vino, lo corriges ahí mismo." },
    AYUDA,
  ],
  "/calendario/servicios": [
    intro("Servicios", "Lo que tu negocio ofrece y el agente puede agendar."),
    PESTANAS_CALENDARIO,
    { ancla: "servicios.form", titulo: "Agregar servicio", texto: "Nombre, duración y precio del servicio." },
    { ancla: "servicios.lista", titulo: "Catálogo", texto: "Edita o desactiva los servicios existentes." },
    AYUDA,
  ],
  "/calendario/proveedores": [
    intro("Proveedores", "Las personas que atienden las citas."),
    PESTANAS_CALENDARIO,
    { ancla: "proveedores.form", titulo: "Agregar proveedor", texto: "Da de alta a quien atiende las citas." },
    { ancla: "proveedores.lista", titulo: "Tu equipo", texto: "Configura el horario de cada proveedor o desactívalo. Tu plan marca cuántos pueden estar activos a la vez." },
    { ancla: "proveedores.lista", titulo: "Acceso al portal", texto: "Con «Dar acceso» le llega un enlace para crear su contraseña. Verá solo su agenda y los chats de sus clientes." },
    AYUDA,
  ],
  "/calendario/corte-diario": [
    intro("Corte diario", "Lo que se atendió y se cobró en un día."),
    PESTANAS_CALENDARIO,
    { ancla: "corte.filtros", titulo: "Día y proveedor", texto: "Elige qué día y qué proveedor revisar." },
    { ancla: "corte.tabla", titulo: "Detalle", texto: "Citas atendidas y lo recaudado." },
    AYUDA,
  ],
  "/calendario/auditoria": [
    intro("Auditoría", "Quién creó, movió o canceló cada reserva."),
    PESTANAS_CALENDARIO,
    { ancla: "auditoria.filtros", titulo: "Filtros", texto: "Acota por fechas, proveedor o tipo de cambio." },
    { ancla: "auditoria.tabla", titulo: "Historial", texto: "Cada cambio con su autor y fecha. Abre una fila para ver su historial completo." },
    AYUDA,
  ],
  "/mi-cartera": [
    intro("Tu cartera", "Aquí ves a tus clientes. Para moverlos de etapa o registrar visitas, usa la app de vendedores."),
    { ancla: "mi-cartera.leads", titulo: "Tus leads", texto: "Los clientes que escribieron por chat y te asignaron, con la etapa en la que van." },
    { ancla: "mi-cartera.campo", titulo: "Clientes de campo", texto: "Los negocios que visitas, con su prioridad y estado." },
    NOTIFICACIONES,
    AYUDA,
  ],
  "/suscripcion": [
    intro("Suscripción", "Tu plan, tus créditos y tus pagos."),
    { ancla: "suscripcion.planes", titulo: "Planes", texto: "Compara los planes y cambia el tuyo." },
    { ancla: "suscripcion.creditos", titulo: "Comprar créditos", texto: "Cuando se acaban los créditos del plan, aquí compras más." },
    { ancla: "suscripcion.historial", titulo: "Historial de pagos", texto: "Todos tus pagos y su estado." },
    AYUDA,
  ],
  "/preferencias": [
    intro("Preferencias", "Tu perfil personal y la apariencia del portal. Si eres el dueño, también los servicios y los usuarios de tu negocio."),
    { ancla: "preferencias.foto", titulo: "Foto de perfil", texto: "Sube o quita tu foto." },
    { ancla: "preferencias.perfil", titulo: "Tus datos", texto: "Completa tu nombre y datos para que el equipo te identifique." },
    { ancla: "preferencias.tema", titulo: "Tema", texto: "Cambia entre tema claro y oscuro." },
    { ancla: "preferencias.servicios", titulo: "Servicios del negocio", texto: "Solo el dueño: enciende o apaga el agente de IA y la gestión de vendedores. Funcionan por separado." },
    { ancla: "preferencias.usuarios", titulo: "Usuarios del negocio", texto: "Invita colaboradores con su propio correo y contraseña, y quítale el acceso a quien ya no deba entrar (también a vendedores y proveedores)." },
    AYUDA,
  ],
  "/pagos/exito": [
    intro("Pago recibido", "Aquí ves el resultado de tu pago."),
    { ancla: "pagos.acciones", titulo: "¿Y ahora?", texto: "Vuelve a tu suscripción o sigue trabajando en el portal." },
    AYUDA,
  ],
  "/pagos/error": [
    intro("El pago no se completó", "No se hizo ningún cargo. Puedes intentarlo de nuevo."),
    { ancla: "pagos.acciones", titulo: "Reintentar", texto: "Vuelve a tu suscripción para intentar el pago otra vez." },
    AYUDA,
  ],
  "/registro": [
    intro("Crea tu cuenta", "En unos minutos tu agente de IA estará listo."),
    { ancla: "auth.form", titulo: "Tus datos", texto: "Tu correo, una contraseña y el nombre de tu negocio. Te enviaremos un código para verificar el correo." },
    { ancla: "auth.google", titulo: "Registro con Google", texto: "También puedes crear la cuenta con Google." },
    AYUDA_PUBLICA,
  ],
  "/invitacion": [
    intro("Te invitaron a un equipo", "Crea tu acceso para entrar al negocio que te invitó."),
    { ancla: "auth.form", titulo: "Elige tu contraseña", texto: "Tu correo ya viene de la invitación. Elige una contraseña: nadie más la conoce, ni el dueño del negocio." },
    AYUDA_PUBLICA,
  ],
  "/recuperar": [
    intro("Recupera tu acceso", "Te enviamos un código para crear una contraseña nueva."),
    { ancla: "auth.form", titulo: "Paso a paso", texto: "Escribe tu correo, ingresa el código que te llegó y elige la nueva contraseña." },
    AYUDA_PUBLICA,
  ],
};

function aRegex(patron: string): RegExp {
  const cuerpo = patron
    .split("/")
    .map((s) => (/^\[.+\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${cuerpo}/?$`);
}

// Las rutas fijas primero: si no, "/vendedores/[id]" se quedaría con
// "/vendedores/actividad".
const COMPILADOS = Object.entries(REGISTRO)
  .sort(([a], [b]) => Number(a.includes("[")) - Number(b.includes("[")))
  .map(([clave, pasos]) => ({ clave, pasos, re: aRegex(clave) }));

/** Patrones registrados (para el test de cobertura). */
export const PATRONES_CON_RECORRIDO = Object.keys(REGISTRO);

export function recorridoParaRuta(pathname: string | null | undefined): Recorrido | null {
  if (!pathname || esRutaGerencia(pathname)) return null;
  const hit = COMPILADOS.find((r) => r.re.test(pathname));
  return hit ? { clave: hit.clave, pasos: hit.pasos } : null;
}

// ------------------------------------------------------------
// "Ya lo vio": la primera visita a cada vista abre el recorrido sola.
// localStorage puede no estar (modo privado, sitio bloqueado): sin él se
// trata como ya visto, para no relanzarlo en cada carga.
// ------------------------------------------------------------
const PREFIJO = "operativai.recorrido";

export function recorridoVisto(usuario: string, clave: string): boolean {
  try {
    return localStorage.getItem(`${PREFIJO}:${usuario}:${clave}`) === "1";
  } catch {
    return true;
  }
}

export function marcarRecorridoVisto(usuario: string, clave: string): void {
  try {
    localStorage.setItem(`${PREFIJO}:${usuario}:${clave}`, "1");
  } catch {
    // sin almacenamiento: no hay nada que recordar
  }
}
