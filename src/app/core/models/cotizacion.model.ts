export type CotizacionEstado =
  | 'pendiente_cotizacion'
  | 'cotizando'
  | 'cotizado'
  | 'taller_seleccionado'
  | 'pago_pendiente'
  | 'pagado'
  | 'en_proceso'
  | 'completado'
  | 'cancelado'
  | 'rechazado';

export const ESTADO_COTIZACION_LABELS: Record<CotizacionEstado, string> = {
  pendiente_cotizacion: 'Pendiente',
  cotizando: 'Buscando talleres',
  cotizado: 'Cotizaciones recibidas',
  taller_seleccionado: 'Taller seleccionado',
  pago_pendiente: 'Pago pendiente',
  pagado: 'Pagado',
  en_proceso: 'En proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
};

export const ESTADO_COTIZACION_COLORS: Record<CotizacionEstado, string> = {
  pendiente_cotizacion: '#6b7280',
  cotizando: '#3b82f6',
  cotizado: '#8b5cf6',
  taller_seleccionado: '#f59e0b',
  pago_pendiente: '#ef4444',
  pagado: '#10b981',
  en_proceso: '#06b6d4',
  completado: '#059669',
  cancelado: '#9ca3af',
  rechazado: '#dc2626',
};

export interface CotizacionRespuesta {
  id: number;
  workshop_id: number;
  workshop_name: string;
  servicios: ServicioCotizado[] | null;
  costo_total: number;
  tiempo_estimado_minutos: number;
  tiempo_estimado_texto: string;
  notas: string | null;
  valida_hasta: string | null;
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'expirada';
  created_at: string | null;
}

export interface Cotizacion {
  id: number;
  tenant_id: number | null;
  client_id: number;
  vehiculo_id: number;
  vehiculo_matricula: string;
  vehiculo_marca: string;
  vehiculo_modelo: string;
  workshop_id: number | null;
  latitud: number;
  longitud: number;
  direccion_referencia: string | null;
  descripcion_dano: string;
  imagenes_dano: string[] | null;
  audio_diagnostico: string | null;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  resumen_ia: string | null;
  es_ambiguo: boolean;
  servicios_cotizados: ServicioCotizado[] | null;
  costo_total_estimado: number | null;
  tiempo_total_estimado_minutos: number | null;
  notas_cotizacion: string | null;
  estado: CotizacionEstado;
  stripe_payment_intent_id: string | null;
  monto_pagado: number | null;
  respuestas: CotizacionRespuesta[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CotizacionListItem {
  id: number;
  vehiculo_id: number;
  vehiculo_matricula: string;
  vehiculo_marca: string;
  vehiculo_modelo: string;
  descripcion_dano: string;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  estado: CotizacionEstado;
  costo_total_estimado: number | null;
  taller_nombre: string | null;
  respuestas_count: number;
  created_at: string | null;
  distance_km?: number;
  ya_respondio?: boolean;
}

export interface ServicioCotizado {
  servicio_id: number;
  nombre: string;
  precio: number;
  tiempo_minutos: number;
}

export interface SolicitarCotizacionRequest {
  vehiculo_id: number;
  latitud: number;
  longitud: number;
  direccion_referencia?: string;
  descripcion_dano: string;
  imagenes_dano?: string[];
  audio_diagnostico?: string;
  radio_busqueda_km?: number;
}

export interface ResponderCotizacionRequest {
  servicios: ServicioCotizado[];
  costo_total: number;
  tiempo_estimado_minutos: number;
  tiempo_estimado_texto: string;
  notas?: string;
  validez_horas?: number;
}
