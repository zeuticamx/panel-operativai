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

// ---- Servicios del tenant ----
export interface ServiciosOut {
  tenant_id: string;
  agente_ia_activo: boolean;
  gestion_vendedores_activo: boolean;
}

/** Parcial: lo que no venga se deja como está. */
export interface ServiciosIn {
  agente_ia_activo?: boolean;
  gestion_vendedores_activo?: boolean;
}

// ---- Vendedores ----
export interface VendedorOut {
  id: string;
  tenant_id: string;
  portal_user_id: string | null;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  creado_en: string;
  /** Leads en estados no cerrados: la carga que mira la asignación. */
  clientes_activos: number;
}

export interface VendedorCrearIn {
  nombre: string;
  telefono?: string | null;
  portal_user_id?: string | null;
}

export interface VendedorActualizarIn {
  nombre?: string;
  telefono?: string | null;
  activo?: boolean;
}

/** Respuesta de POST /api/vendedores/{id}/reasignar-pendientes */
export interface ReasignacionOut {
  vendedor_id: string;
  estrategia: EstrategiaAsignacion;
  reasignados: number;
  /** Leads que se quedaron con el vendedor original por falta de destino. */
  sin_destino: number;
  destinos: Record<string, number>;
}

// ---- Pipeline ----
export type EstadoPipeline =
  | "nuevo"
  | "contactado"
  | "en_seguimiento"
  | "cotizado"
  | "negociacion"
  | "ganado"
  | "perdido";

export interface AsignarClienteIn {
  /** null = que decida la estrategia del tenant. */
  vendedor_id: string | null;
  nota?: string | null;
}

export interface PipelineOut {
  id: string;
  user_id: string;
  cliente_nombre: string | null;
  cliente_handle: string | null;
  vendedor_id: string | null;
  vendedor_nombre: string | null;
  /** En la práctica `EstadoPipeline`; el backend lo manda como texto. */
  estado: string;
  /** Pydantic serializa Decimal como string en JSON. */
  monto_estimado: string | null;
  motivo_perdida: string | null;
  actualizado_en: string;
  transiciones_posibles: string[];
}

export interface HistorialOut {
  estado_anterior: string | null;
  estado_nuevo: string;
  vendedor_id: string | null;
  vendedor_nombre: string | null;
  nota: string | null;
  creado_en: string;
}

// ---- Config de asignación ----
export type EstrategiaAsignacion = "carga" | "round_robin" | "manual";

export interface ConfigAsignacionOut {
  tenant_id: string;
  estrategia_asignacion: EstrategiaAsignacion;
  ultimo_vendedor_asignado_id: string | null;
}

export interface ConfigAsignacionIn {
  estrategia_asignacion: EstrategiaAsignacion;
}

// ---- Métricas del embudo ----
export interface MetricaEtapaOut {
  estado: string;
  total: number;
  /** Sobre el total de leads del tenant, 0–100. */
  porcentaje: number;
  /** null si ningún lead atravesó la etapa entera todavía. */
  horas_promedio: number | null;
}

export interface RankingVendedorOut {
  vendedor_id: string;
  nombre: string;
  activo: boolean;
  abiertos: number;
  ganados: number;
  perdidos: number;
  /** Decimal serializado como string. */
  monto_ganado: string;
  /** 0–100. null si no cerró nada todavía. */
  tasa_cierre: number | null;
}

export interface MetricasPipelineOut {
  total_clientes: number;
  etapas: MetricaEtapaOut[];
  /** 0–100. null si no hay leads cerrados. */
  tasa_conversion_global: number | null;
  ranking: RankingVendedorOut[];
}
