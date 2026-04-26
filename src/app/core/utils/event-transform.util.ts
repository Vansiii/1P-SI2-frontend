/**
 * Event Transformation Utilities
 *
 * Transforms raw real-time events into UI-friendly formats for consumption
 * by Angular components. Provides type-safe helpers for extracting and
 * formatting event data.
 *
 * Requirements: 1.14, 3.2, 11.2, 11.4
 */

import {
  RealtimeEvent,
  EventPriority,
  IncidentStatus,
  IncidentCreatedEventData,
  IncidentAssignedEventData,
  IncidentStatusChangedEventData,
  IncidentCancelledEventData
} from '../models/realtime-events.models';

// ============================================================================
// UI-FRIENDLY DATA MODELS
// ============================================================================

/** Normalized incident summary for list/card display */
export interface IncidentSummaryUI {
  incidentId: number;
  status: IncidentStatus;
  description?: string;
  workshopId?: number;
  technicianId?: number;
  changedAt: Date;
  priorityLabel: string;
  statusLabel: string;
}

/** Normalized chat message for display */
export interface ChatMessageUI {
  messageId: number;
  incidentId: number;
  senderId: number;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file';
  sentAt: Date;
  isOwn: boolean;
}

/** Typing indicator for chat UI */
export interface TypingIndicatorUI {
  incidentId: number;
  userId: number;
  userName: string;
  startedAt: Date;
}

/** Technician location for map display */
export interface TechnicianLocationUI {
  incidentId: number;
  technicianId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  updatedAt: Date;
}

/** ETA / route info for tracking display */
export interface RouteInfoUI {
  incidentId: number;
  technicianId: number;
  distanceKm: number;
  durationMinutes: number;
  eta: Date;
  updatedAt: Date;
}

/** In-app notification for notification panel */
export interface NotificationUI {
  notificationId: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  createdAt: Date;
  iconClass: string;
}

/** Dashboard metrics for display */
export interface DashboardMetricsUI {
  activeIncidents: number;
  pendingIncidents: number;
  completedToday: number;
  activeTechnicians: number;
  averageResponseTimeMinutes: number;
  updatedAt: Date;
}

/** Alert for dashboard alert panel */
export interface DashboardAlertUI {
  alertId: string;
  alertType: 'sla_breach' | 'high_load' | 'system_error';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: Date;
  severityClass: string;
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

const PRIORITY_LABELS: Record<EventPriority, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  aceptado: 'Aceptado',
  en_camino: 'En camino',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
  sin_taller_disponible: 'Sin taller disponible',
};

const NOTIFICATION_ICON_CLASSES: Record<string, string> = {
  info: 'icon-info-circle text-blue-500',
  warning: 'icon-warning text-yellow-500',
  error: 'icon-error text-red-500',
  success: 'icon-check-circle text-green-500',
};

const ALERT_SEVERITY_CLASSES: Record<string, string> = {
  low: 'alert-low text-gray-600',
  medium: 'alert-medium text-yellow-600',
  high: 'alert-high text-orange-600',
  critical: 'alert-critical text-red-600',
};

// ============================================================================
// INCIDENT TRANSFORMATIONS
// ============================================================================

/**
 * Transform an incident.created event into a UI-friendly summary.
 */
export function transformIncidentCreated(event: RealtimeEvent<IncidentCreatedEventData>): IncidentSummaryUI {
  const data = event.data;
  const incident = data.incident || data;
  const incidentId = incident.id || (data as any).incident_id;
  
  return {
    incidentId: incidentId,
    status: 'pendiente',
    description: incident.descripcion,
    changedAt: new Date(incident.created_at),
    priorityLabel: event.priority ? PRIORITY_LABELS[event.priority] : 'Medio',
    statusLabel: STATUS_LABELS['pendiente'],
  };
}

/**
 * Transform an incident.assigned event into a UI-friendly summary.
 */
export function transformIncidentAssigned(event: RealtimeEvent<IncidentAssignedEventData>): IncidentSummaryUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    status: 'asignado',
    technicianId: data.suggested_technician?.technician_id,
    changedAt: new Date(event.timestamp),
    priorityLabel: event.priority ? PRIORITY_LABELS[event.priority] : 'Medio',
    statusLabel: STATUS_LABELS['asignado'],
  };
}

/**
 * Transform an incident.status_changed event into a UI-friendly summary.
 */
export function transformIncidentStatusChanged(event: RealtimeEvent<IncidentStatusChangedEventData>): IncidentSummaryUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    status: data.new_status,
    changedAt: new Date(event.timestamp),
    priorityLabel: event.priority ? PRIORITY_LABELS[event.priority] : 'Medio',
    statusLabel: STATUS_LABELS[data.new_status] || data.new_status,
  };
}

/**
 * Transform an incident.cancelled event into a UI-friendly summary.
 */
export function transformIncidentCancelled(event: RealtimeEvent<IncidentCancelledEventData>): IncidentSummaryUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    status: 'cancelado',
    changedAt: new Date(data.cancelled_at),
    priorityLabel: event.priority ? PRIORITY_LABELS[event.priority] : 'Medio',
    statusLabel: STATUS_LABELS['cancelado'],
  };
}

/**
 * Transform an incident.work_completed event into a UI-friendly summary.
 */
export function transformIncidentWorkCompleted(event: RealtimeEvent<any>): IncidentSummaryUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    status: 'resuelto',
    technicianId: data.technician_id,
    changedAt: new Date(data.completed_at || event.timestamp),
    priorityLabel: event.priority ? PRIORITY_LABELS[event.priority] : 'Medio',
    statusLabel: STATUS_LABELS['resuelto'],
  };
}

// ============================================================================
// CHAT TRANSFORMATIONS
// ============================================================================

/**
 * Transform a chat.message_sent event into a UI-friendly message.
 * @param currentUserId - The ID of the currently logged-in user (to mark own messages)
 */
export function transformChatMessage(
  event: RealtimeEvent<any>,
  currentUserId?: number
): ChatMessageUI {
  const data = event.data;
  
  return {
    messageId: data.message_id,
    incidentId: data.incident_id,
    senderId: data.sender_id,
    senderName: data.sender_name,
    content: data.content,
    messageType: data.message_type,
    sentAt: new Date(data.sent_at || event.timestamp),
    isOwn: currentUserId !== undefined && data.sender_id === currentUserId,
  };
}

/**
 * Transform a chat.user_typing event into a UI-friendly typing indicator.
 */
export function transformTypingIndicator(event: RealtimeEvent<any>): TypingIndicatorUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    userId: data.user_id,
    userName: data.user_name,
    startedAt: new Date(data.started_at || event.timestamp),
  };
}

// ============================================================================
// TRACKING TRANSFORMATIONS
// ============================================================================

/**
 * Transform a tracking.location_updated event into a UI-friendly location.
 */
export function transformTechnicianLocation(
  event: RealtimeEvent<any>
): TechnicianLocationUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    technicianId: data.technician_id,
    latitude: data.location.latitude,
    longitude: data.location.longitude,
    accuracy: data.location.accuracy,
    heading: data.location.heading,
    speed: data.location.speed,
    updatedAt: new Date(data.updated_at || event.timestamp),
  };
}

/**
 * Transform a tracking.route_updated event into a UI-friendly route info.
 */
export function transformRouteInfo(event: RealtimeEvent<any>): RouteInfoUI {
  const data = event.data;
  
  return {
    incidentId: data.incident_id,
    technicianId: data.technician_id,
    distanceKm: Math.round((data.distance / 1000) * 10) / 10,
    durationMinutes: Math.round(data.duration / 60),
    eta: new Date(data.eta),
    updatedAt: new Date(data.updated_at || event.timestamp),
  };
}

// ============================================================================
// NOTIFICATION TRANSFORMATIONS
// ============================================================================

/**
 * Transform a notification.received event into a UI-friendly notification.
 */
export function transformNotification(event: RealtimeEvent<any>): NotificationUI {
  const data = event.data;
  
  return {
    notificationId: data.notification_id,
    userId: data.user_id,
    title: data.title,
    message: data.message || data.body,
    type: data.type,
    createdAt: new Date(data.created_at || event.timestamp),
    iconClass: NOTIFICATION_ICON_CLASSES[data.type] ?? NOTIFICATION_ICON_CLASSES['info'],
  };
}

// ============================================================================
// DASHBOARD TRANSFORMATIONS
// ============================================================================

/**
 * Transform a dashboard.metrics_updated event into UI-friendly metrics.
 */
export function transformDashboardMetrics(event: RealtimeEvent<any>): DashboardMetricsUI {
  const data = event.data;
  
  return {
    activeIncidents: data.active_incidents,
    pendingIncidents: data.pending_incidents,
    completedToday: data.completed_today,
    activeTechnicians: data.active_technicians,
    averageResponseTimeMinutes: Math.round(data.average_response_time / 60),
    updatedAt: new Date(data.updated_at || event.timestamp),
  };
}

/**
 * Transform a dashboard.alert_triggered event into a UI-friendly alert.
 */
export function transformDashboardAlert(event: RealtimeEvent<any>): DashboardAlertUI {
  const data = event.data;
  
  return {
    alertId: data.alert_id,
    alertType: data.alert_type,
    message: data.message,
    severity: data.severity,
    triggeredAt: new Date(data.triggered_at || event.timestamp),
    severityClass: ALERT_SEVERITY_CLASSES[data.severity] ?? ALERT_SEVERITY_CLASSES['low'],
  };
}

// ============================================================================
// GENERIC HELPERS
// ============================================================================

/**
 * Get a human-readable label for an event priority.
 */
export function getPriorityLabel(priority: EventPriority): string {
  return PRIORITY_LABELS[priority];
}

/**
 * Get a human-readable label for an incident status.
 */
export function getStatusLabel(status: IncidentStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Extract the incident ID from any event that carries one in its payload.
 * Returns undefined if the event type does not carry an incident_id.
 */
export function extractIncidentId(event: RealtimeEvent): number | undefined {
  const data = event.data || (event as any);
  return typeof data?.incident_id === 'number' ? data.incident_id : undefined;
}

/**
 * Format an ISO timestamp string into a locale-aware display string.
 */
export function formatEventTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString();
}
