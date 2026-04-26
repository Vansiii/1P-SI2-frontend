/**
 * Incident Models for Solicitudes Entrantes
 * 
 * Complete TypeScript interfaces and types for incident management.
 * Includes core models, related entities, validation rules, and utility types.
 */

// ============================================================================
// ENUMS AND UNION TYPES
// ============================================================================

/**
 * Incident priority levels
 */
export type IncidentPriority = 'alta' | 'media' | 'baja';

/**
 * Incident status throughout the workflow
 */
export type IncidentStatus = 
  | 'pendiente'
  | 'asignado'
  | 'aceptado'
  | 'en_camino'
  | 'en_proceso'
  | 'resuelto'
  | 'cancelado'
  | 'sin_taller_disponible';

/**
 * Filter options for incident list
 */
export type IncidentFilter = 
  | 'todos'
  | 'pendientes'
  | 'asignadas'
  | 'en_proceso'
  | 'resueltas';

/**
 * Evidence type
 */
export type EvidenceType = 'imagen' | 'audio' | 'video';

/**
 * AI processing status
 */
export type AIProcessingStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timeout';

// ============================================================================
// RELATED MODELS
// ============================================================================

/**
 * Client information
 */
export interface Client {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  created_at: string;
}

/**
 * Vehicle information
 */
export interface Vehicle {
  id: number;
  marca: string;
  modelo: string;
  anio: number;
  placa: string;
  color: string;
  cliente_id: number;
}

/**
 * Incident category
 */
export interface Category {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string | null;
}

/**
 * Workshop information
 */
export interface Workshop {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  latitud: number;
  longitud: number;
}

/**
 * Technician specialty
 */
export interface Specialty {
  id: number;
  nombre: string;
}

/**
 * Technician information
 */
export interface Technician {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  especialidades: Specialty[];
  taller_id: number;
  disponible: boolean;
}

// ============================================================================
// ASSIGNMENT AND TIMEOUT MODELS
// ============================================================================

/**
 * Suggested technician with timeout information
 */
export interface SuggestedTechnician {
  technician_id: number;
  technician_name: string;
  distance_km: number;
  compatibility_score: number;
  timeout_at: string; // ISO 8601 datetime
  assigned_at: string; // ISO 8601 datetime
}

/**
 * Timeout status computed from SuggestedTechnician
 */
export interface TimeoutStatus {
  has_timeout: boolean;
  time_remaining_minutes: number | null;
  is_warning: boolean; // true if < 2 minutes remaining
}

// ============================================================================
// EVIDENCE MODELS
// ============================================================================

/**
 * Base evidence interface
 */
export interface Evidence {
  id: number;
  tipo: EvidenceType;
  url: string;
  descripcion: string | null;
  created_at: string;
}

/**
 * Image evidence
 */
export interface ImageEvidence extends Evidence {
  tipo: 'imagen';
  thumbnail_url: string;
}

/**
 * Audio evidence
 */
export interface AudioEvidence extends Evidence {
  tipo: 'audio';
  duration_seconds: number;
}

// ============================================================================
// AI ANALYSIS MODEL
// ============================================================================

/**
 * AI analysis of incident
 */
export interface AIAnalysis {
  id: number;
  incident_id: number;
  analysis: string;
  suggested_category: string | null;
  suggested_priority: IncidentPriority | null;
  confidence_score: number;
  processing_status: AIProcessingStatus;
  created_at: string;
}

// ============================================================================
// MAIN INCIDENT MODEL
// ============================================================================

/**
 * Main incident model representing a service request
 */
export interface Incident {
  // Primary identification
  id: number;
  
  // Basic information
  descripcion: string;
  prioridad: IncidentPriority;
  estado: IncidentStatus;
  
  // Relationships
  cliente_id: number;
  cliente?: Client;
  vehiculo_id: number;
  vehiculo?: Vehicle;
  categoria_id: number;
  categoria?: Category;
  taller_id: number | null;
  taller?: Workshop;
  tecnico_id: number | null;
  tecnico?: Technician;
  
  // Location
  ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion_referencia: string | null;
  
  // Assignment and timeout
  suggested_technician: SuggestedTechnician | null;
  rejection_count: number;
  has_timeout: boolean;
  timeout_at: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Additional data
  evidencias?: Evidence[];
  ai_analysis?: AIAnalysis | null;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for checking if evidence is image
 */
export function isImageEvidence(evidence: Evidence): evidence is ImageEvidence {
  return evidence.tipo === 'imagen';
}

/**
 * Type guard for checking if evidence is audio
 */
export function isAudioEvidence(evidence: Evidence): evidence is AudioEvidence {
  return evidence.tipo === 'audio';
}

/**
 * Type guard for checking if incident has active timeout
 */
export function hasActiveTimeout(incident: Incident): boolean {
  if (!incident.suggested_technician?.timeout_at) return false;
  return new Date(incident.suggested_technician.timeout_at) < new Date();
}

/**
 * Type guard for checking if incident is pending
 */
export function isPendingIncident(incident: Incident): boolean {
  return incident.estado === 'pendiente';
}

/**
 * Type guard for checking if incident is assigned
 */
export function isAssignedIncident(incident: Incident): boolean {
  return incident.estado === 'asignado';
}

/**
 * Type guard for checking if incident is in progress
 */
export function isInProgressIncident(incident: Incident): boolean {
  return ['aceptado', 'en_camino', 'en_proceso'].includes(incident.estado);
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Partial update for incident
 */
export type IncidentUpdate = Partial<Omit<Incident, 'id' | 'created_at'>>;

/**
 * Required fields for creating incident
 */
export type CreateIncidentDTO = Pick<
  Incident,
  'descripcion' | 'prioridad' | 'cliente_id' | 'vehiculo_id' | 'categoria_id'
> & {
  ubicacion?: string;
  latitud?: number;
  longitud?: number;
  direccion_referencia?: string;
};

/**
 * Fields returned in list view (optimized)
 */
export type IncidentListItem = Pick<
  Incident,
  | 'id'
  | 'descripcion'
  | 'prioridad'
  | 'estado'
  | 'created_at'
  | 'ubicacion'
  | 'suggested_technician'
  | 'has_timeout'
> & {
  categoria: Pick<Category, 'id' | 'nombre'>;
};

// ============================================================================
// ACTION MODELS (ACCEPT/REJECT)
// ============================================================================

/**
 * Data for accepting an incident
 */
export interface AcceptIncidentRequest {
  incident_id: number;
  technician_id: number | null; // null for manual assignment later
  accept_with_suggested: boolean;
}

/**
 * Response from accepting an incident
 */
export interface AcceptIncidentResponse {
  success: boolean;
  incident: Incident;
  message: string;
}

/**
 * Data for rejecting an incident
 */
export interface RejectIncidentRequest {
  incident_id: number;
  rejection_reason: string;
}

/**
 * Response from rejecting an incident
 */
export interface RejectIncidentResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// FILTER AND STATE MODELS
// ============================================================================

/**
 * Filter counts for each status
 */
export interface FilterCounts {
  todos: number;
  pendientes: number;
  asignadas: number;
  en_proceso: number;
  resueltas: number;
}

/**
 * Loading state for different operations
 */
export interface LoadingState {
  initial: boolean;
  detail: boolean;
  action: boolean;
}

/**
 * Error state with context
 */
export interface ErrorState {
  message: string;
  code: string | null;
  timestamp: string;
}

// ============================================================================
// UI-SPECIFIC MODELS
// ============================================================================

/**
 * UI state for incident card
 */
export interface IncidentCardUI {
  incident: Incident;
  timeoutStatus: TimeoutStatus;
  isSelected: boolean;
  isHovered: boolean;
}

/**
 * Modal state for accept action
 */
export interface AcceptModalState {
  isOpen: boolean;
  loading: boolean;
  selectedOption: 'suggested' | 'manual' | null;
}

/**
 * Modal state for reject action
 */
export interface RejectModalState {
  isOpen: boolean;
  loading: boolean;
  reason: string;
  reasonError: string | null;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected: string | null;
}

// ============================================================================
// API RESPONSE MODELS
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Standard API error response
 */
export interface APIError {
  error: string;
  message: string;
  status_code: number;
  details?: Record<string, any>;
}

/**
 * Success response wrapper
 */
export interface APISuccess<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validation rules for incident fields
 */
export const IncidentValidation = {
  descripcion: {
    minLength: 10,
    maxLength: 500,
    required: true
  },
  prioridad: {
    values: ['alta', 'media', 'baja'] as const,
    required: true
  },
  estado: {
    values: [
      'pendiente',
      'asignado',
      'aceptado',
      'en_camino',
      'en_proceso',
      'resuelto',
      'cancelado',
      'sin_taller_disponible'
    ] as const,
    required: true
  }
} as const;

/**
 * Validation rules for rejection reason
 */
export const RejectionValidation = {
  reason: {
    minLength: 10,
    maxLength: 200,
    required: true
  }
} as const;

// ============================================================================
// STATE TRANSITION RULES
// ============================================================================

/**
 * Valid state transitions for incidents
 */
export const ValidStateTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  pendiente: ['asignado', 'sin_taller_disponible', 'cancelado'],
  asignado: ['aceptado', 'cancelado'],
  aceptado: ['en_camino', 'cancelado'],
  en_camino: ['en_proceso', 'cancelado'],
  en_proceso: ['resuelto', 'cancelado'],
  resuelto: [],
  cancelado: [],
  sin_taller_disponible: []
};

/**
 * Check if state transition is valid
 */
export function isValidTransition(
  from: IncidentStatus,
  to: IncidentStatus
): boolean {
  return ValidStateTransitions[from].includes(to);
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Timeout configuration
 */
export const TimeoutConfig = {
  VERIFICATION_INTERVAL_MS: 30000, // 30 seconds
  WARNING_THRESHOLD_MINUTES: 2,
  DEFAULT_TIMEOUT_MINUTES: 15
} as const;

/**
 * UI configuration
 */
export const UIConfig = {
  DESCRIPTION_TRUNCATE_LENGTH: 100,
  GRID_BREAKPOINTS: {
    LARGE: 1400, // 3 columns
    MEDIUM: 1024, // 2 columns
    SMALL: 0 // 1 column
  },
  DEBOUNCE_MS: 300,
  TOAST_DURATION_MS: 3000
} as const;

/**
 * Priority colors (WCAG AA compliant)
 */
export const PriorityColors: Record<IncidentPriority, string> = {
  alta: '#dc2626', // Red 600 - WCAG AA compliant
  media: '#d97706', // Amber 600 - WCAG AA compliant
  baja: '#2563eb' // Blue 600 - WCAG AA compliant
};

/**
 * Status colors (WCAG AA compliant)
 */
export const StatusColors: Record<IncidentStatus, string> = {
  pendiente: '#6b7280', // Gray 500 - WCAG AA compliant
  asignado: '#0891b2', // Cyan 600 - WCAG AA compliant
  aceptado: '#059669', // Emerald 600 - WCAG AA compliant
  en_camino: '#7c3aed', // Violet 600 - WCAG AA compliant
  en_proceso: '#ea580c', // Orange 600 - WCAG AA compliant
  resuelto: '#16a34a', // Green 600 - WCAG AA compliant
  cancelado: '#dc2626', // Red 600 - WCAG AA compliant
  sin_taller_disponible: '#991b1b' // Red 800 - WCAG AA compliant
};
