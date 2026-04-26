/**
 * Real-Time Event Models for Solicitudes Entrantes
 * 
 * TypeScript interfaces for real-time event types used in the Solicitudes Entrantes feature.
 * These models ensure type safety for WebSocket events.
 */

import type { Incident, IncidentStatus, SuggestedTechnician } from './incident.model';

// Re-export types that other services need
export type { IncidentStatus } from './incident.model';

/**
 * Event priority levels
 */
export type EventPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Base real-time event structure
 */
export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  data: T;
  timestamp: string;
  version: string;
  priority?: EventPriority;
}

/**
 * Real-time event types - Complete list for all system events
 */
export type RealtimeEventType =
  // Incident events (with dot notation)
  | 'incident.created'
  | 'incident.assigned'
  | 'incident.status_changed'
  | 'incident.assignment_accepted'
  | 'incident.assignment_rejected'
  | 'incident.assignment_timeout'
  | 'incident.no_workshop_available'
  | 'incident.cancelled'
  | 'incident.technician_on_way'
  | 'incident.technician_arrived'
  | 'incident.work_started'
  | 'incident.work_completed'
  | 'incident.reassigned'
  // Legacy incident events (underscore notation)
  | 'incident_status_change'
  | 'incident_status_changed'
  | 'incident_updated'
  | 'incident_created'
  | 'incident_assigned'
  | 'incident_assignment_accepted'
  | 'incident_assignment_rejected'
  | 'incident_assignment_timeout'
  | 'incident_no_workshop_available'
  | 'incident_cancelled'
  | 'incident_technician_on_way'
  | 'incident_technician_arrived'
  | 'incident_work_started'
  | 'incident_work_completed'
  | 'incident_reassigned'
  // Technician events
  | 'technician_assigned'
  | 'technician_arrived'
  | 'technician_availability_changed'
  | 'technician_duty_started'
  | 'technician_duty_ended'
  | 'technician_updated'
  | 'technician_status_change'
  // Vehicle events
  | 'vehicle_created'
  | 'vehicle_updated'
  | 'vehicle_deleted'
  | 'vehicle_image_uploaded'
  // Service events
  | 'service_started'
  | 'service_completed'
  | 'service_paused'
  | 'service_resumed'
  // Chat events
  | 'new_message'
  | 'new_chat_message'
  | 'chat.message_sent'
  | 'chat.user_typing'
  | 'chat.user_stopped_typing'
  | 'chat.message_delivered'
  | 'chat.message_read'
  | 'chat.file_uploaded'
  | 'user_typing'
  | 'user_stopped_typing'
  | 'message_read'
  // Tracking events
  | 'tracking.location_updated'
  | 'tracking.session_started'
  | 'tracking.session_ended'
  | 'tracking.route_updated'
  | 'location_update'
  | 'tracking_started'
  | 'tracking_ended'
  // Evidence events
  | 'evidence_uploaded'
  | 'evidence_image_uploaded'
  | 'evidence_audio_uploaded'
  | 'evidence_deleted'
  // Notification events
  | 'notification.received'
  | 'notification.badge_updated'
  | 'notification_created'
  | 'notification_read'
  | 'notifications_all_read'
  // Workshop events
  | 'workshop_availability_changed'
  | 'workshop_verified'
  | 'workshop_updated'
  | 'workshop_balance_updated'
  // Cancellation events
  | 'cancellation.requested'
  | 'cancellation.approved'
  | 'cancellation.rejected'
  // Dashboard events
  | 'dashboard.metrics_updated'
  | 'dashboard.incident_count_changed'
  | 'dashboard.active_technicians_changed'
  | 'dashboard.alert_triggered'
  // Audit events
  | 'audit_log_created';

// ============================================================================
// EVENT DATA INTERFACES
// ============================================================================

/**
 * Event data for incident.created
 */
export interface IncidentCreatedEventData {
  incident: Incident;
}

/**
 * Event data for incident.assigned
 */
export interface IncidentAssignedEventData {
  incident_id: number;
  suggested_technician: SuggestedTechnician;
}

/**
 * Event data for incident.status_changed
 */
export interface IncidentStatusChangedEventData {
  incident_id: number;
  old_status: IncidentStatus;
  new_status: IncidentStatus;
  changed_by: string;
}

/**
 * Event data for incident.assignment_accepted
 */
export interface IncidentAssignmentAcceptedEventData {
  incident_id: number;
  workshop_id: number;
  technician_id: number | null;
  accepted_at: string;
}

/**
 * Event data for incident.assignment_rejected
 */
export interface IncidentAssignmentRejectedEventData {
  incident_id: number;
  workshop_id: number;
  rejection_reason: string;
  rejection_count: number;
  rejected_at: string;
}

/**
 * Event data for incident.assignment_timeout
 */
export interface IncidentAssignmentTimeoutEventData {
  incident_id: number;
  workshop_id: number;
  timeout_at: string;
}

/**
 * Event data for incident.no_workshop_available
 */
export interface IncidentNoWorkshopAvailableEventData {
  incident_id: number;
  reason: string;
}

/**
 * Event data for incident.cancelled
 */
export interface IncidentCancelledEventData {
  incident_id: number;
  cancelled_by: string;
  cancellation_reason: string;
  cancelled_at: string;
}

/**
 * Event data for incident.technician_on_way
 */
export interface IncidentTechnicianOnWayEventData {
  incident_id: number;
  technician_id: number;
  started_at: string;
}

/**
 * Event data for incident.technician_arrived
 */
export interface IncidentTechnicianArrivedEventData {
  incident_id: number;
  technician_id: number;
  arrived_at: string;
}

/**
 * Event data for incident.work_started
 */
export interface IncidentWorkStartedEventData {
  incident_id: number;
  started_at: string;
}

/**
 * Event data for incident.work_completed
 */
export interface IncidentWorkCompletedEventData {
  incident_id: number;
  completed_at: string;
}

/**
 * Event data for evidence_image_uploaded
 */
export interface EvidenceImageUploadedEventData {
  incident_id: number;
  photo_urls: string[];
  uploaded_at: string;
}

/**
 * Event data for tracking.location_updated
 */
export interface TrackingLocationUpdatedEventData {
  incident_id: number;
  technician_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

/**
 * Event data for tracking.session_started
 */
export interface TrackingSessionStartedEventData {
  session_id: number;
  incident_id: number;
  technician_id: number;
  start_time: string;
}

/**
 * Event data for tracking.session_ended
 */
export interface TrackingSessionEndedEventData {
  incident_id: number;
  end_time: string;
  total_distance: number;
}

/**
 * Event data for tracking.route_updated
 */
export interface TrackingRouteUpdatedEventData {
  incident_id: number;
  technician_id: number;
  estimated_arrival: string;
  distance_remaining: number;
  route_points: Array<{ latitude: number; longitude: number }>;
}

/**
 * Event data for chat.message_sent
 */
export interface ChatMessageSentEventData {
  message_id: number;
  incident_id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  created_at: string;
}

/**
 * Event data for chat.user_typing
 */
export interface ChatUserTypingEventData {
  incident_id: number;
  user_id: number;
  user_name: string;
}

/**
 * Event data for chat.user_stopped_typing
 */
export interface ChatUserStoppedTypingEventData {
  incident_id: number;
  user_id: number;
}

/**
 * Event data for chat.message_delivered
 */
export interface ChatMessageDeliveredEventData {
  message_id: number;
  incident_id: number;
  delivered_at: string;
}

/**
 * Event data for chat.message_read
 */
export interface ChatMessageReadEventData {
  message_id: number;
  incident_id: number;
  read_at: string;
}

/**
 * Event data for chat.file_uploaded
 */
export interface ChatFileUploadedEventData {
  message_id: number;
  incident_id: number;
  file_name: string;
  file_url: string;
  file_size: number;
}

/**
 * Event data for notification.received
 */
export interface NotificationReceivedEventData {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  data?: any;
  created_at: string;
}

/**
 * Event data for notification.badge_updated
 */
export interface NotificationBadgeUpdatedEventData {
  unread_count: number;
  total_count: number;
  updated_at: string;
}

/**
 * Event data for dashboard.metrics_updated
 */
export interface DashboardMetricsUpdatedEventData {
  active_incidents: number;
  pending_incidents: number;
  completed_today: number;
  active_technicians: number;
  average_response_time: number;
  updated_at: string;
}

/**
 * Event data for dashboard.incident_count_changed
 */
export interface DashboardIncidentCountChangedEventData {
  total_count: number;
  by_status: Record<string, number>;
  changed_at: string;
}

/**
 * Event data for dashboard.active_technicians_changed
 */
export interface DashboardActiveTechniciansChangedEventData {
  active_count: number;
  technician_ids: number[];
  changed_at: string;
}

/**
 * Event data for dashboard.alert_triggered
 */
export interface DashboardAlertTriggeredEventData {
  alert_id: string;
  alert_type: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  triggered_at: string;
}

// ============================================================================
// TYPED EVENT INTERFACES
// ============================================================================

/**
 * Typed real-time events for type-safe event handling
 */
export type IncidentCreatedEvent = RealtimeEvent<IncidentCreatedEventData>;
export type IncidentAssignedEvent = RealtimeEvent<IncidentAssignedEventData>;
export type IncidentStatusChangedEvent = RealtimeEvent<IncidentStatusChangedEventData>;
export type IncidentAssignmentAcceptedEvent = RealtimeEvent<IncidentAssignmentAcceptedEventData>;
export type IncidentAssignmentRejectedEvent = RealtimeEvent<IncidentAssignmentRejectedEventData>;
export type IncidentAssignmentTimeoutEvent = RealtimeEvent<IncidentAssignmentTimeoutEventData>;
export type IncidentNoWorkshopAvailableEvent = RealtimeEvent<IncidentNoWorkshopAvailableEventData>;
export type IncidentCancelledEvent = RealtimeEvent<IncidentCancelledEventData>;
export type IncidentTechnicianOnWayEvent = RealtimeEvent<IncidentTechnicianOnWayEventData>;
export type IncidentTechnicianArrivedEvent = RealtimeEvent<IncidentTechnicianArrivedEventData>;
export type IncidentWorkStartedEvent = RealtimeEvent<IncidentWorkStartedEventData>;
export type IncidentWorkCompletedEvent = RealtimeEvent<IncidentWorkCompletedEventData>;
export type EvidenceImageUploadedEvent = RealtimeEvent<EvidenceImageUploadedEventData>;

export type TrackingLocationUpdatedEvent = RealtimeEvent<TrackingLocationUpdatedEventData>;
export type TrackingSessionStartedEvent = RealtimeEvent<TrackingSessionStartedEventData>;
export type TrackingSessionEndedEvent = RealtimeEvent<TrackingSessionEndedEventData>;
export type TrackingRouteUpdatedEvent = RealtimeEvent<TrackingRouteUpdatedEventData>;

export type ChatMessageSentEvent = RealtimeEvent<ChatMessageSentEventData>;
export type ChatUserTypingEvent = RealtimeEvent<ChatUserTypingEventData>;
export type ChatUserStoppedTypingEvent = RealtimeEvent<ChatUserStoppedTypingEventData>;
export type ChatMessageDeliveredEvent = RealtimeEvent<ChatMessageDeliveredEventData>;
export type ChatMessageReadEvent = RealtimeEvent<ChatMessageReadEventData>;
export type ChatFileUploadedEvent = RealtimeEvent<ChatFileUploadedEventData>;

export type NotificationReceivedEvent = RealtimeEvent<NotificationReceivedEventData>;
export type NotificationBadgeUpdatedEvent = RealtimeEvent<NotificationBadgeUpdatedEventData>;

export type DashboardMetricsUpdatedEvent = RealtimeEvent<DashboardMetricsUpdatedEventData>;
export type DashboardIncidentCountChangedEvent = RealtimeEvent<DashboardIncidentCountChangedEventData>;
export type DashboardActiveTechniciansChangedEvent = RealtimeEvent<DashboardActiveTechniciansChangedEventData>;
export type DashboardAlertTriggeredEvent = RealtimeEvent<DashboardAlertTriggeredEventData>;

/**
 * Union type of all typed events
 */
export type AnyRealtimeEvent =
  | IncidentCreatedEvent
  | IncidentAssignedEvent
  | IncidentStatusChangedEvent
  | IncidentAssignmentAcceptedEvent
  | IncidentAssignmentRejectedEvent
  | IncidentAssignmentTimeoutEvent
  | IncidentNoWorkshopAvailableEvent
  | IncidentCancelledEvent
  | IncidentTechnicianOnWayEvent
  | IncidentTechnicianArrivedEvent
  | IncidentWorkStartedEvent
  | IncidentWorkCompletedEvent
  | EvidenceImageUploadedEvent
  | TrackingLocationUpdatedEvent
  | TrackingSessionStartedEvent
  | TrackingSessionEndedEvent
  | TrackingRouteUpdatedEvent
  | ChatMessageSentEvent
  | ChatUserTypingEvent
  | ChatUserStoppedTypingEvent
  | ChatMessageDeliveredEvent
  | ChatMessageReadEvent
  | ChatFileUploadedEvent
  | NotificationReceivedEvent
  | NotificationBadgeUpdatedEvent
  | DashboardMetricsUpdatedEvent
  | DashboardIncidentCountChangedEvent
  | DashboardActiveTechniciansChangedEvent
  | DashboardAlertTriggeredEvent;
