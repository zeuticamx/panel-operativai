/**
 * Tipos espejo de backend/schemas.py. Si el backend cambia un campo,
 * cámbialo aquí también — no inventes campos que no existan allá.
 */

// ---- Auth ----
export interface TokenOut {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface UsuarioOut {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  tenant_id: string | null;
  nombre_negocio: string | null;
}

export interface RegistroIn {
  email: string;
  password: string;
  full_name?: string | null;
  nombre_negocio: string;
}

/**
 * Respuesta de POST /api/auth/registro y /reenviar-codigo. No trae tokens:
 * la cuenta no existe hasta que se verifica el código.
 */
export interface VerificacionPendienteOut {
  email: string;
  expira_en_minutos: number;
  reenviar_en_segundos: number;
}

export interface VerificarCodigoIn {
  email: string;
  /** Exactamente 6 dígitos. */
  codigo: string;
}

export interface ReenviarCodigoIn {
  email: string;
}

export interface LoginIn {
  email: string;
  password: string;
}

// ---- Agente ----
export interface AgenteConfig {
  agent_name: string;
  system_prompt: string;
  model: string | null;
  temperature: number;
  history_window: number;
  is_active: boolean;
}

export interface ModelosOut {
  modelos: string[];
}

// ---- Canales ----
export interface CanalOut {
  channel_type: string;
  page_id: string | null;
  ig_user_id: string | null;
  phone_number_id: string | null;
  is_active: boolean;
  updated_at: string | null;
}

export interface ConectarMetaOut {
  conectado: boolean;
  scopes: string[];
  expira: string | null;
}

export interface PaginaDisponible {
  page_id: string;
  nombre: string;
  ig_user_id: string | null;
  ig_username: string | null;
  ya_conectada: boolean;
}

export interface ActivarResultado {
  page_id: string;
  ok: boolean;
  nombre?: string | null;
  canales?: string[];
  detalle?: string;
}

export interface ActivarOut {
  resultados: ActivarResultado[];
}

// ---- Herramientas ----
/** GET /api/herramientas/info — el correo con el que hay que compartir el documento. */
export interface HerramientaInfoOut {
  correo_servicio: string;
}

export type HerramientaTipo = "google_sheets" | "google_docs";

export interface HerramientaOut {
  tool_key: string;
  /** En la práctica `HerramientaTipo`, pero el backend lo devuelve como texto libre. */
  tool_type: string;
  display_name: string;
  description: string;
  is_enabled: boolean;
  last_verified_at: string | null;
  /** Título real del documento en Google, no lo que escribió el usuario. */
  nombre_documento: string | null;
  url_original: string | null;
}

export interface ConectarGoogleSheetIn {
  url: string;
  display_name: string;
  description: string;
  /** Default del backend: "A:Z". */
  rango?: string;
}

export interface ConectarGoogleDocIn {
  url: string;
  display_name: string;
  description: string;
}

export interface ActualizarHerramientaIn {
  display_name?: string;
  description?: string;
  is_enabled?: boolean;
}

// ---- Conversaciones ----
export interface ConversacionOut {
  id: string;
  channel_type: string;
  status: string;
  started_at: string;
  last_message_at: string;
  usuario_nombre: string | null;
  usuario_handle: string | null;
  /** Solo Instagram: Messenger y WhatsApp no exponen un @usuario. */
  usuario_username: string | null;
  total_mensajes: number;
  ultimo_mensaje: string | null;
  /** Ventana de 24h de Meta. null si el cliente nunca escribió. */
  ultimo_mensaje_cliente_at: string | null;
  /** Negativo = ya se cerró hace esa cantidad de minutos. */
  minutos_restantes_ventana: number | null;
}

export interface MensajeOut {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ConversacionDetalleOut {
  id: string;
  channel_type: string;
  status: string;
  started_at: string;
  usuario_nombre: string | null;
  usuario_handle: string | null;
  usuario_username: string | null;
  ultimo_mensaje_cliente_at: string | null;
  minutos_restantes_ventana: number | null;
  mensajes: MensajeOut[];
}

/** Respuesta de POST /api/conversaciones/{id}/contacto */
export interface ContactoOut {
  usuario_nombre: string | null;
  usuario_username: string | null;
  actualizado: boolean;
}

export interface MetricasOut {
  conversaciones_activas: number;
  mensajes_hoy: number;
  mensajes_7d: number;
  conversaciones_7d: number;
  por_canal: Record<string, number>;
}
