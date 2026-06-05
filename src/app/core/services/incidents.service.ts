import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { OfflineCacheService } from './offline-cache.service';
import { 
  Incident, 
  AIAnalysis,
  AcceptIncidentResponse,
  RejectIncidentResponse,
  AIProcessingStatus,
  Client,
  Vehicle,
  Workshop,
  Technician,
  isValidTransition
} from '../models/incident.model';
import { safeIncidentMerge } from '../utils/incident-list.utils';

// Legacy incident interface for backward compatibility with existing code
export interface LegacyIncident {
  id: number;
  cliente_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  estado_actual: string;
  estado_label: string;
  descripcion: string;
  latitud: number | null;
  longitud: number | null;
  direccion_referencia: string | null;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  prioridad_label: string;
  created_at: string;
  updated_at: string;
  cliente?: Client;
  vehiculo?: Vehicle;
  taller?: Workshop | null;
  tecnico?: Technician | null;
  resumen_ia?: string | null;
  es_ambiguo?: boolean;
  assigned_at?: string | null;
  suggested_technician?: {
    technician_id: number;
    technician_name: string;
    distance_km: number;
    compatibility_score: number;
  } | null;
}

export type IncidentAiAnalysisStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface IncidentAiAnalysis {
  id: number;
  incident_id: number;
  status: IncidentAiAnalysisStatus;
  model_name: string;
  prompt_version: string;
  request_hash: string;
  attempt_number: number;
  category: string | null;
  priority: string | null;
  summary: string | null;
  is_ambiguous: boolean;
  confidence: number | null;
  findings: string[];
  missing_data: string[];
  workshop_recommendation: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopInfo {
  id: number;
  workshop_name: string;
  workshop_phone: string | null;
  address: string | null;
}

export interface AssignmentAttemptInfo {
  id: number;
  workshop_id: number;
  workshop_name: string;
  attempted_at: string;
  response_status: 'pending' | 'accepted' | 'rejected' | 'no_response' | 'timeout' | 'cancelled';
  rejection_reason: string | null;
  responded_at: string | null;
}

export interface RejectionInfo {
  id: number;
  taller_id: number;
  workshop_name: string;
  motivo: string;
  created_at: string;
}

export interface StateHistoryInfo {
  id: number;
  estado_nombre: string;
  estado_descripcion: string | null;
  changed_by_user_name: string | null;
  comentario: string | null;
  fecha: string;
}

export interface ClientInfo {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface VehicleInfo {
  id: number;
  marca: string | null;
  modelo: string;
  anio: number;
  matricula: string;
  color: string | null;
}

export interface IncidentDetailAdmin {
  id: number;
  estado_actual: string;
  descripcion: string;
  latitude: number | null;
  longitude: number | null;
  direccion_referencia: string | null;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  resumen_ia: string | null;
  es_ambiguo: boolean;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  client: ClientInfo;
  vehiculo: VehicleInfo;
  current_workshop: WorkshopInfo | null;
  assignment_attempts: AssignmentAttemptInfo[];
  rejections: RejectionInfo[];
  state_history: StateHistoryInfo[];
  total_attempts: number;
  total_rejections: number;
  total_no_responses: number;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentsService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly authService = inject(AuthService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  // Estado reactivo de incidentes
  private incidentsSubject = new BehaviorSubject<LegacyIncident[]>([]);
  public incidents$ = this.incidentsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  /** Emits whenever a new incident_assigned event arrives — components can subscribe to refresh counters */
  public readonly incidentAssigned$ = new Subject<any>();

  public readonly incidentTimeout$ = new Subject<any>();

  /** Atomic lock to prevent concurrent fetches for the same incident */
  private fetchingIncidents = new Set<number>();

  constructor() {
    this.subscribeToWebSocket();
  }

  private toInt(value: any): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Suscribirse a eventos WebSocket para actualizaciones en tiempo real
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        // ✅ Manejar ambos nombres: legacy (sin 'd') y nuevo (con 'd'), y el formato con punto
        case 'incident_status_change':
        case 'incident_status_changed':
        case 'incident.status_changed':
          this.handleIncidentStatusChange(message.data ?? message);
          break;
        case 'incident_updated':
        case 'incident.updated':
          this.handleIncidentUpdated(message.data ?? message);
          break;
        case 'incident_created':
        case 'incident.created':
          this.handleIncidentCreated(message.data ?? message);
          break;
        case 'incident_assigned':
        case 'incident.assigned':
          this.handleIncidentAssigned(message.data ?? message);
          break;
        case 'incident_assignment_accepted':
        case 'incident.assignment_accepted':
          this.handleAssignmentAccepted(message.data ?? message);
          break;
        case 'incident_assignment_rejected':
        case 'incident.assignment_rejected':
          this.handleAssignmentRejected(message.data ?? message);
          break;
        case 'incident_assignment_timeout':
        case 'incident.assignment_timeout':
          this.handleAssignmentTimeout(message.data ?? message);
          break;
        case 'incident_no_workshop_available':
        case 'incident.no_workshop_available':
          this.handleNoWorkshopAvailable(message.data ?? message);
          break;
        case 'incident_cancelled':
        case 'incident.cancelled':
          this.handleIncidentCancelled(message.data ?? message);
          break;
        case 'cancellation.approved':
          this.handleMutualCancellationApproved(message.data ?? message);
          break;
        case 'incident_technician_on_way':
        case 'incident.technician_on_way':
          this.handleTechnicianOnWay(message.data ?? message);
          break;
        case 'incident_technician_arrived':
        case 'incident.technician_arrived':
          this.handleTechnicianArrived(message.data ?? message);
          break;
        case 'incident_work_started':
        case 'incident.work_started':
          this.handleWorkStarted(message.data ?? message);
          break;
        case 'incident_work_completed':
        case 'incident.work_completed':
          this.handleWorkCompleted(message.data ?? message);
          break;
        case 'technician_assigned':
          this.handleTechnicianAssigned(message.data ?? message);
          break;
        case 'technician_arrived':
          this.handleTechnicianArrived(message.data ?? message);
          break;
        case 'vehicle_created':
          this.handleVehicleCreated(message.data ?? message);
          break;
        case 'vehicle_updated':
          this.handleVehicleUpdated(message.data ?? message);
          break;
        case 'vehicle_deleted':
          this.handleVehicleDeleted(message.data ?? message);
          break;
        case 'service_started':
          this.handleServiceStarted(message.data ?? message);
          break;
        case 'service_completed':
          this.handleServiceCompleted(message.data ?? message);
          break;
        case 'incident_reassigned':
        case 'incident.reassigned':
          this.handleIncidentReassigned(message.data ?? message);
          break;
      }
    });
  }

  /**
   * Manejar cambio de estado de incidente (soporta ambos formatos de payload)
   * ✅ CORREGIDO: Usa inmutabilidad completa sin mutar arrays
   */
  private handleIncidentStatusChange(data: any): void {
    // ✅ Manejar ambos formatos de payload (legacy y nuevo)
    const incidentId = this.toInt(data?.incident_id ?? data?.data?.incident_id);
    const rawNewStatus = data?.estado_actual ?? data?.new_status ?? data?.data?.estado_actual;
    const newStatus = this.mapStatus(String(rawNewStatus || '').toLowerCase());
    const reason = String(data?.reason ?? data?.data?.reason ?? '').toLowerCase();

    if (!incidentId || !rawNewStatus) {
      console.warn('❌ incident_status_change: payload incompleto', data);
      return;
    }

    console.log(`📨 Cambio de estado recibido: incidente ${incidentId} → ${newStatus}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    // ✅ Si el incidente pasa a "sin_taller_disponible", actualizar su estado
    // Los talleres deben verlo como "sin_taller_disponible" y el filtro del componente lo oculta
    if (newStatus === 'sin_taller_disponible') {
      if (index !== -1) {
        const currentUser = this.authService.currentUser();
        if (currentUser?.user_type === 'workshop') {
          const filtered = incidents.filter(i => i.id !== incidentId);
          this.incidentsSubject.next(filtered);
          console.log(`🚫 Incident ${incidentId} removed from workshop list (sin_taller_disponible)`);
        } else {
          console.log(`🚫 Incidente ${incidentId} pasó a sin_taller_disponible - actualizando estado`);
          const updated = [...incidents];
          updated[index] = safeIncidentMerge(updated[index], {
            estado_actual: newStatus,
            updated_at: data.timestamp || new Date().toISOString()
          });
          this.incidentsSubject.next(updated);
        }
      }
      return;
    }

    // Cancelación mutua: el incidente deja de pertenecer al taller actual inmediatamente.
    if (newStatus === 'pendiente' && reason === 'mutual_cancellation') {
      const currentUser = this.authService.currentUser();
      const incidentId = this.toInt(data.incident_id);

      if (!incidentId) {
        return;
      }
      if (currentUser?.user_type === 'workshop') {
        const filtered = incidents.filter(i => i.id !== incidentId);
        if (filtered.length !== incidents.length) {
          this.incidentsSubject.next(filtered);
          console.log(`🚫 Incident ${incidentId} removed from workshop list (mutual_cancellation)`);
        }
        return;
      }
    }

    if (index !== -1) {
      const currentStatus = this.mapStatus(String(incidents[index].estado_actual || '').toLowerCase()) as any;

      if (!isValidTransition(currentStatus, newStatus)) {
        console.warn(
          `⚠️ Transición inválida ignorada: ${currentStatus} → ${newStatus} para incidente ${incidentId}`
        );
        return;
      }

      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: newStatus,
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Estado actualizado en cache: incidente ${incidentId} → ${newStatus}`);
    } else {
      // Si el incidente no está en la lista, podría ser nuevo para este usuario
      console.log(`ℹ️ Incidente ${incidentId} no encontrado en cache local`);
    }
  }

  /**
   * Manejar actualización general de incidente (campos múltiples)
   * ✅ ACTUALIZACIÓN PARCIAL: Solo actualiza los campos que cambiaron
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleIncidentUpdated(data: any): void {
    const incidentId = this.toInt(data?.incident_id);
    const updatedFields = data?.updated_fields;

    if (!incidentId || !updatedFields) {
      console.warn('❌ incident_updated: payload incompleto', data);
      return;
    }

    console.log(`📨 Actualización de incidente recibida: incidente ${incidentId}`, updatedFields);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      const currentStatus = this.mapStatus(String(incidents[index].estado_actual || '').toLowerCase()) as any;
      const rawNewStatus = updatedFields.estado_actual || updatedFields.estado;
      const newStatus = rawNewStatus
        ? this.mapStatus(String(rawNewStatus).toLowerCase())
        : undefined;
      const updatedWorkshopId = this.toInt(updatedFields?.taller_id);

      const currentUser = this.authService.currentUser();
      if (
        currentUser?.user_type === 'workshop' &&
        Object.prototype.hasOwnProperty.call(updatedFields, 'taller_id')
      ) {
        const userWorkshopId = this.toInt(currentUser.workshop_id ?? currentUser.id);
        if (!userWorkshopId || updatedWorkshopId !== userWorkshopId) {
          const filtered = incidents.filter(i => i.id !== incidentId);
          this.incidentsSubject.next(filtered);
          console.log(`🚫 Incident ${incidentId} removed from workshop list (updated_fields.taller_id mismatch)`);
          return;
        }
      }

      if (newStatus === 'sin_taller_disponible') {
        const currentUser = this.authService.currentUser();
        if (currentUser?.user_type === 'workshop') {
          const filtered = incidents.filter(i => i.id !== incidentId);
          this.incidentsSubject.next(filtered);
          console.log(`🚫 Incident ${incidentId} removed from workshop list (incident.updated → sin_taller_disponible)`);
          return;
        }
      }

      if (newStatus && !isValidTransition(currentStatus, newStatus)) {
        console.warn(
          `⚠️ Transición inválida ignorada en incident_updated: ${currentStatus} → ${newStatus} para incidente ${incidentId}`
        );
        return;
      }

      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        ...updatedFields,
        ...(newStatus ? { estado: newStatus as any, estado_actual: newStatus } : {}),
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} actualizado en cache con campos:`, Object.keys(updatedFields));
    } else {
      // Si no está en cache, hacer fetch solo de ese incidente
      console.log(`ℹ️ Incidente ${incidentId} no encontrado en cache, haciendo fetch individual`);
      this.getIncidentDetail(incidentId).subscribe({
        next: (incident) => {
          const currentIncidents = this.incidentsSubject.value;
          // ✅ CORREGIDO: Crear nuevo array en vez de mutar
          const updatedList = [incident, ...currentIncidents];
          this.incidentsSubject.next(updatedList);
          console.log(`✅ Incidente ${incidentId} agregado al cache después de fetch`);
        },
        error: (error) => {
          console.error(`❌ Error fetching incident ${incidentId}:`, error);
        }
      });
    }
  }

  /**
   * Manejar asignación de técnico
   * ✅ ACTUALIZACIÓN PARCIAL: Actualiza técnico y taller sin refetch HTTP
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleTechnicianAssigned(data: any): void {
    const incidentId = data?.incident_id;
    const technicianId = data?.technician_id || data?.technician?.id;
    const technicianName = data?.technician_name || data?.technician?.name;
    const workshopId = data?.workshop_id;
    const estadoActual = data?.estado_actual || 'asignado';

    if (!incidentId || !technicianId) {
      console.warn('❌ technician_assigned: payload incompleto', data);
      return;
    }

    console.log(`📨 Técnico asignado: ${technicianName} (ID: ${technicianId}) → incidente ${incidentId}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      // ✅ CORREGIDO: Usar safeIncidentMerge
      updated[index] = safeIncidentMerge(updated[index], {
        tecnico_id: technicianId,
        taller_id: workshopId || updated[index].taller_id,
        estado_actual: estadoActual,
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Técnico ${technicianName} asignado a incidente ${incidentId} en cache`);
    } else {
      console.log(`ℹ️ Incidente ${incidentId} no encontrado en cache local`);
    }
  }

  /**
   * Manejar llegada de técnico
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleTechnicianArrived(data: any): void {
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'en_proceso',
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Technician arrived at incident ${data.incident_id}`);
    }
  }

  /**
   * Manejar nuevo incidente creado
   * ✅ ACTUALIZACIÓN COMPLETA: Hace fetch del incidente completo desde el servidor
   */
  private handleIncidentCreated(data: any): void {
    const currentUser = this.authService.currentUser();

    if (currentUser?.user_type === 'workshop') {
      console.log('⏭️ Skipping incident_created: workshops receive incidents via incident_assigned');
      return;
    }

    const incidentId = data.incident_id;
    const incidents = this.incidentsSubject.value;
    const exists = incidents.some(i => i.id === incidentId);

    if (exists || this.fetchingIncidents.has(incidentId)) {
      console.log(`ℹ️ Incident ${incidentId} already exists or fetch in progress`);
      return;
    }

    this.fetchingIncidents.add(incidentId);
    console.log(`📨 New incident ${incidentId} created, fetching complete data`);
    
    this.getIncidentDetail(incidentId).subscribe({
      next: (completeIncident) => {
        this.fetchingIncidents.delete(incidentId);
        const currentIncidents = this.incidentsSubject.value;
        if (!currentIncidents.some(i => i.id === incidentId)) {
          this.incidentsSubject.next([completeIncident, ...currentIncidents]);
          console.log(`✅ Complete incident ${incidentId} added to cache`);
        }
      },
      error: (error) => {
        this.fetchingIncidents.delete(incidentId);
        console.error(`❌ Error fetching complete incident ${incidentId}:`, error);
        const currentIncidents = this.incidentsSubject.value;
        if (!currentIncidents.some(i => i.id === incidentId)) {
          const basicIncident: LegacyIncident = {
            id: incidentId,
            cliente_id: data.client_id || 0,
            vehiculo_id: data.vehiculo_id || 0,
            taller_id: null,
            tecnico_id: null,
            estado_actual: 'pendiente',
            estado_label: 'Pendiente',
            descripcion: data.descripcion || 'Sin descripción',
            latitud: data.latitude || 0,
            longitud: data.longitude || 0,
            direccion_referencia: data.direccion_referencia || null,
            categoria_ia: null,
            prioridad_ia: null,
            prioridad_label: 'Media',
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.timestamp || new Date().toISOString()
          };
          this.incidentsSubject.next([basicIncident, ...currentIncidents]);
          console.log(`⚠️ Basic incident ${incidentId} added to cache (fetch failed)`);
        }
      }
    });
  }

  /**
   * Manejar incidente asignado a taller (notificación en tiempo real)
   * ✅ ACTUALIZACIÓN PARCIAL: Solo actualiza el incidente afectado sin refetch HTTP
   * ✅ CORREGIDO: Usa inmutabilidad completa y aplica el estado del evento
   * 
   * IMPORTANTE: El incidente sigue en "pendiente" hasta que el taller acepte.
   * El evento incident.assigned NO cambia el estado — solo notifica al taller.
   */
  private resolveAssignmentTimeoutAt(data: any): string {
    const explicitTimeout =
      data?.timeout_at ||
      data?.suggested_technician?.timeout_at ||
      data?.suggested_technician_info?.timeout_at;

    if (explicitTimeout) {
      return explicitTimeout;
    }

    const estimatedMinutesRaw =
      data?.estimated_time ??
      data?.estimated_time_minutes ??
      data?.response_timeout_minutes;
    const estimatedMinutes = Number(estimatedMinutesRaw);

    if (Number.isFinite(estimatedMinutes) && estimatedMinutes > 0) {
      return new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();
    }

    return new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  private handleIncidentAssigned(data: any): void {
    console.log('🔔 Incident assigned event received:', data);

    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident_assigned: user is not a workshop');
      return;
    }

    const userWorkshopId = this.toInt(currentUser.workshop_id ?? currentUser.id);
    const targetWorkshopId = this.toInt(data.workshop_id);
    if (!userWorkshopId || !targetWorkshopId) {
      return;
    }

    if (targetWorkshopId !== userWorkshopId) {
      console.log(
        `⏭️ Skipping incident_assigned: workshop_id ${data.workshop_id} ` +
        `does not match current workshop ${userWorkshopId}`
      );
      return;
    }

    console.log(`✅ Processing incident_assigned for workshop ${userWorkshopId}`);

    const incidents = this.incidentsSubject.value;
    const timeoutAt = this.resolveAssignmentTimeoutAt(data);
    const incidentId = this.toInt(data.incident_id);
    if (!incidentId) return;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      const updated = [...incidents];
      const techData = data.technician_id ? {
        suggested_technician: {
          technician_id: data.technician_id,
          technician_name: data.technician_name || '',
          distance_km: data.distance_km || 0,
          compatibility_score: data.compatibility_score || 0,
          timeout_at: timeoutAt,
        }
      } : {};
      updated[index] = safeIncidentMerge(updated[index], {
        taller_id: data.workshop_id,
        ...(timeoutAt ? { timeout_at: timeoutAt } : {}),
        updated_at: data.timestamp || new Date().toISOString(),
        ...techData
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incident ${incidentId} updated in cache (pending for workshop ${data.workshop_id})`);
    } else {
      console.log(`ℹ️ Incidente ${data.incident_id} no encontrado en cache, haciendo fetch completo`);
      this.getIncidentDetail(incidentId).subscribe({
        next: (legacyIncident) => {
          const currentIncidents = this.incidentsSubject.value;
          legacyIncident.taller_id = data.workshop_id;
          legacyIncident.updated_at = data.timestamp || new Date().toISOString();
          (legacyIncident as any).timeout_at = timeoutAt;
          if (data.technician_id && !legacyIncident.suggested_technician) {
            legacyIncident.suggested_technician = {
              technician_id: data.technician_id,
              technician_name: data.technician_name || '',
              distance_km: data.distance_km || 0,
              compatibility_score: data.compatibility_score || 0,
              timeout_at: timeoutAt,
            } as any;
          } else if (legacyIncident.suggested_technician) {
            (legacyIncident.suggested_technician as any).timeout_at =
              (legacyIncident.suggested_technician as any).timeout_at || timeoutAt;
          }
          const updatedList = [legacyIncident, ...currentIncidents];
          this.incidentsSubject.next(updatedList);
          console.log(`✅ Incidente ${incidentId} agregado al cache con fetch exitoso`);
        },
        error: (err) => {
          console.error(`❌ Error fetching incident ${incidentId}:`, err);
          const newIncident: LegacyIncident = {
            id: incidentId,
            cliente_id: data.client_id || 0,
            vehiculo_id: data.vehiculo_id || 0,
            taller_id: data.workshop_id,
            tecnico_id: data.technician_id || null,
            estado_actual: 'pendiente',
            estado_label: 'Pendiente',
            descripcion: data.descripcion || 'Descripción no disponible',
            latitud: data.latitude || 0,
            longitud: data.longitude || 0,
            direccion_referencia: data.direccion_referencia || null,
            categoria_ia: data.categoria_ia || null,
            prioridad_ia: data.prioridad_ia || null,
            prioridad_label: data.prioridad_ia || 'Media',
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.timestamp || new Date().toISOString(),
            suggested_technician: data.technician_id ? {
              technician_id: data.technician_id,
              technician_name: data.technician_name || '',
              distance_km: 0,
              compatibility_score: 0,
              timeout_at: timeoutAt,
            } as any : null
          };
          (newIncident as any).timeout_at = timeoutAt;
          const fallbackList = [newIncident, ...this.incidentsSubject.value];
          this.incidentsSubject.next(fallbackList);
          console.log(`⚠️ Incidente ${incidentId} agregado con datos básicos (fetch falló)`);
        }
      });
    }

    this.incidentAssigned$.next(data);
  }

  /**
   * Manejar aceptación de asignación por un taller
   * ✅ CORREGIDO: Si otro taller aceptó, remover el incidente de la vista del taller actual
   * Si este taller aceptó, actualizar el estado usando new_status del evento
   */
  private handleAssignmentAccepted(data: any): void {
    console.log('✅ Assignment accepted event received:', data);

    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident_assignment_accepted: user is not a workshop');
      return;
    }

    const userWorkshopId = this.toInt(currentUser.workshop_id ?? currentUser.id);
    const acceptedWorkshopId = this.toInt(data.workshop_id);
    const incidentId = this.toInt(data.incident_id);
    if (!userWorkshopId || !incidentId) {
      return;
    }
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (!acceptedWorkshopId || acceptedWorkshopId !== userWorkshopId) {
      if (index !== -1) {
        const filtered = incidents.filter(i => i.id !== incidentId);
        this.incidentsSubject.next(filtered);
        console.log(
          `🚫 Incidente ${incidentId} removido de la vista del taller ${userWorkshopId} ` +
          `(aceptado por taller ${data.workshop_id})`
        );
      }
    } else {
      if (index !== -1) {
        const newStatus = data.new_status || data.estado_actual || 'asignado';
        const updated = [...incidents];
        updated[index] = safeIncidentMerge(updated[index], {
          taller_id: acceptedWorkshopId,
          tecnico_id: data.technician_id || updated[index].tecnico_id,
          estado_actual: newStatus,
          updated_at: data.timestamp || new Date().toISOString()
        });
        this.incidentsSubject.next(updated);
        console.log(
          `✅ Incident ${incidentId} accepted by THIS workshop ${data.workshop_name} (id: ${data.workshop_id}), new status: ${newStatus}`
        );
      }
    }
  }

  /**
   * Manejar rechazo de asignación por un taller
   * ✅ CORREGIDO: Remueve el incidente de la vista del taller que rechazó
   * El backend se encarga de buscar un nuevo taller automáticamente
   */
  private handleAssignmentRejected(data: any): void {
    console.log('❌ Assignment rejected event received:', data);

    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident_assignment_rejected: user is not a workshop');
      return;
    }

    const userWorkshopId = this.toInt(currentUser.workshop_id ?? currentUser.id);
    const workshopId = this.toInt(data.workshop_id);
    const incidentId = this.toInt(data.incident_id);
    if (!userWorkshopId || !incidentId) return;

    if (workshopId === userWorkshopId) {
      const incidents = this.incidentsSubject.value;
      const filtered = incidents.filter(i => i.id !== incidentId);
      
      if (filtered.length !== incidents.length) {
        this.incidentsSubject.next(filtered);
        console.log(`🚫 Incidente ${incidentId} removido de la vista del taller ${userWorkshopId} (rechazado)`);
      }
    } else {
      const incidents = this.incidentsSubject.value;
      const index = incidents.findIndex(i => i.id === incidentId);

      if (index !== -1) {
        const updated = [...incidents];
        updated[index] = safeIncidentMerge(updated[index], {
          updated_at: data.timestamp || new Date().toISOString()
        });
        this.incidentsSubject.next(updated);
      }
    }
  }

  /**
   * Manejar timeout de asignación
   * Actualiza indicadores de estado en el dashboard de administración
   * y actualiza el estado del incidente
   */
  private async handleAssignmentTimeout(data: any): Promise<void> {
    console.log('⏰ Assignment timeout event received:', data);

    this.incidentTimeout$.next(data);

    console.warn(
      `⏰ Assignment attempt timed out for incident ${data.incident_id} ` +
      `(workshop: ${data.workshop_name}, id: ${data.workshop_id})`
    );

    try {
      const currentUser = this.authService.currentUser();

      const incidentId = this.toInt(data.incident_id);

      if (!incidentId) {
        return;
      }

      if (data.assignment_mode === 'manual' && currentUser?.user_type === 'workshop') {
        const incidents = this.incidentsSubject.value;
        const filteredIncidents = incidents.filter(i => i.id !== incidentId);
        this.incidentsSubject.next(filteredIncidents);
        console.log(`🚫 Manual incident ${data.incident_id} removed from workshop list (timeout)`);
        return;
      }
      if (currentUser?.user_type === 'workshop') {
        const userWorkshopId = this.toInt(currentUser.workshop_id ?? currentUser.id);
        const timedOutWorkshopId = this.toInt(data.workshop_id);
        const incidents = this.incidentsSubject.value;
        const index = incidents.findIndex(i => i.id === incidentId);

        if (!userWorkshopId || !timedOutWorkshopId || timedOutWorkshopId !== userWorkshopId) {
          console.log(
            `Skipping timeout update for workshop ${userWorkshopId} ` +
            `(event belongs to workshop ${timedOutWorkshopId})`
          );
          return;
        }

        if (index === -1) {
          console.log(`Incident ${incidentId} is not in workshop cache during timeout`);
          return;
        }

        const updated = [...incidents];
        updated[index] = safeIncidentMerge(updated[index], {
          estado_actual: 'pendiente',
          estado_label: 'Pendiente',
          updated_at: data.timed_out_at || data.timestamp || new Date().toISOString()
        });
        this.incidentsSubject.next(updated);
        console.log(`Automatic incident ${incidentId} kept visible after timeout for workshop ${userWorkshopId}`);
        return;
      }
      // Fetch the updated incident to get its current state
      // Don't just remove it - it might have been reassigned or changed state
      const updatedIncident = await this.getIncidentById(incidentId);
      const normalizedStatus = this.mapStatus(
        String(
          (updatedIncident as any)?.estado ??
          (updatedIncident as any)?.estado_actual ??
          ''
        ).toLowerCase()
      );

      // Re-read cache AFTER fetch to detect concurrent updates from other handlers
      const incidents = this.incidentsSubject.value;
      const index = incidents.findIndex(i => i.id === incidentId);

      if (index !== -1 && incidents[index].estado_actual === 'sin_taller_disponible') {
        console.log(`⏭️ Skipping timeout update: incident ${data.incident_id} already in sin_taller_disponible`);
        return;
      }

      // Convert to LegacyIncident format manually
      const legacyIncident: LegacyIncident = {
        id: updatedIncident.id,
        cliente_id: updatedIncident.cliente?.id || 0,
        vehiculo_id: updatedIncident.vehiculo?.id || 0,
        taller_id: updatedIncident.taller_id,
        tecnico_id: updatedIncident.tecnico_id,
        latitud: updatedIncident.latitud ?? 0,
        longitud: updatedIncident.longitud ?? 0,
        direccion_referencia: updatedIncident.direccion_referencia || '',
        descripcion: updatedIncident.descripcion,
        estado_actual: normalizedStatus,
        estado_label: normalizedStatus,
        categoria_ia: updatedIncident.ai_analysis?.suggested_category || null,
        prioridad_ia: updatedIncident.ai_analysis?.suggested_priority || null,
        prioridad_label: updatedIncident.ai_analysis?.suggested_priority || 'media',
        resumen_ia: updatedIncident.ai_analysis?.analysis || null,
        es_ambiguo: false,
        created_at: updatedIncident.created_at,
        updated_at: updatedIncident.updated_at,
        assigned_at: null,
        cliente: updatedIncident.cliente ? {
          id: updatedIncident.cliente.id,
          nombre: updatedIncident.cliente.nombre,
          apellido: updatedIncident.cliente.apellido,
          email: updatedIncident.cliente.email,
          telefono: updatedIncident.cliente.telefono,
          created_at: updatedIncident.cliente.created_at
        } : undefined,
        vehiculo: updatedIncident.vehiculo ? {
          id: updatedIncident.vehiculo.id,
          marca: updatedIncident.vehiculo.marca,
          modelo: updatedIncident.vehiculo.modelo,
          anio: updatedIncident.vehiculo.anio,
          placa: updatedIncident.vehiculo.placa,
          color: updatedIncident.vehiculo.color,
          cliente_id: updatedIncident.vehiculo.cliente_id
        } : undefined
      };

      if (index !== -1) {
        const currentUser = this.authService.currentUser();
        if (currentUser?.user_type === 'workshop' && normalizedStatus === 'sin_taller_disponible') {
          const filteredIncidents = incidents.filter(i => i.id !== incidentId);
          this.incidentsSubject.next(filteredIncidents);
          console.log(`🚫 Incident ${data.incident_id} removed from workshop list (sin_taller_disponible)`);
          return;
        }

        // Update existing incident
        incidents[index] = legacyIncident;
        this.incidentsSubject.next([...incidents]);
        console.log(`✅ Incident ${data.incident_id} updated after timeout`);
      } else {
        // Add to list if not present (might have been filtered out)
        this.incidentsSubject.next([...incidents, legacyIncident]);
        console.log(`✅ Incident ${data.incident_id} added to list after timeout`);
      }
    } catch (error) {
      console.error(`❌ Error fetching incident ${data.incident_id} after timeout:`, error);
      const currentUser = this.authService.currentUser();
      if (currentUser?.user_type === 'workshop') {
        console.log('Keeping workshop list unchanged after timeout fetch failure');
        return;
      }
      // If fetch fails, just remove it from the list as fallback
      const incidents = this.incidentsSubject.value;
      const filteredIncidents = incidents.filter(i => i.id !== data.incident_id);
      if (filteredIncidents.length !== incidents.length) {
        this.incidentsSubject.next(filteredIncidents);
        console.log(`⚠️ Incident ${data.incident_id} removed from list (fetch failed)`);
      }
    }
  }

  /**
   * ✅ Manejar cancelación de incidente
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleIncidentCancelled(data: any): void {
    const incidentId = this.toInt(data?.incident_id);
    if (!incidentId) return;

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    const currentUser = this.authService.currentUser();
    if (currentUser?.user_type === 'workshop') {
      const filtered = incidents.filter(i => i.id !== incidentId);
      if (filtered.length !== incidents.length) {
        this.incidentsSubject.next(filtered);
        console.log(`🚫 Incidente ${incidentId} removido de la lista del taller (cancelado)`);
      }
      return;
    }

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'cancelado'
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} marcado como cancelado`);
    }
  }

  private handleMutualCancellationApproved(data: any): void {
    const incidentId = this.toInt(data?.incident_id);
    if (!incidentId) return;

    const currentUser = this.authService.currentUser();
    if (currentUser?.user_type !== 'workshop') {
      return;
    }

    const incidents = this.incidentsSubject.value;
    const filtered = incidents.filter(i => i.id !== incidentId);
    if (filtered.length !== incidents.length) {
      this.incidentsSubject.next(filtered);
      console.log(`🚫 Incident ${incidentId} removed from workshop list (cancellation.approved)`);
    }
  }

  /**
   * ✅ Manejar creación de vehículo
   * Actualización parcial: no requiere refetch de incidentes
   */
  private handleVehicleCreated(data: any): void {
    const vehicleId = data?.vehicle_id;
    const clientId = data?.client_id;

    if (!vehicleId || !clientId) {
      console.warn('❌ vehicle_created: payload incompleto', data);
      return;
    }

    console.log(`📨 Vehículo creado: ${vehicleId} para cliente ${clientId}`);
    
    // Los incidentes que usen este vehículo se actualizarán con incident_updated
    // No es necesario refetch aquí
  }

  /**
   * ✅ Manejar actualización de vehículo
   * Actualización parcial: actualiza datos del vehículo en incidentes relacionados
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleVehicleUpdated(data: any): void {
    const vehicleId = data?.vehicle_id;
    
    if (!vehicleId) {
      console.warn('❌ vehicle_updated: payload incompleto', data);
      return;
    }

    console.log(`📨 Vehículo actualizado: ${vehicleId}`, data);

    // Actualizar incidentes que tengan este vehículo
    const incidents = this.incidentsSubject.value;
    let updated = false;

    const updatedIncidents = incidents.map(incident => {
      if (incident.vehiculo_id === vehicleId && incident.vehiculo) {
        updated = true;
        return {
          ...incident,
          vehiculo: {
            ...incident.vehiculo,
            marca: data.marca ?? incident.vehiculo.marca,
            modelo: data.modelo ?? incident.vehiculo.modelo,
            anio: data.anio ?? incident.vehiculo.anio,
            placa: data.matricula ?? incident.vehiculo.placa
          },
          updated_at: data.timestamp || new Date().toISOString()
        };
      }
      return incident;
    });

    if (updated) {
      this.incidentsSubject.next(updatedIncidents);
      console.log(`✅ Incidentes actualizados con datos del vehículo ${vehicleId}`);
    }
  }

  /**
   * ✅ Manejar eliminación de vehículo
   * Actualización parcial: marca incidentes relacionados
   */
  private handleVehicleDeleted(data: any): void {
    const vehicleId = data?.vehicle_id;
    
    if (!vehicleId) {
      console.warn('❌ vehicle_deleted: payload incompleto', data);
      return;
    }

    console.log(`📨 Vehículo eliminado: ${vehicleId}`);

    // Los incidentes relacionados deberían ser manejados por el backend
    // Este evento es principalmente informativo
  }

  /**
   * ✅ Manejar inicio de servicio
   * Actualización parcial: actualiza estado del incidente a 'en_proceso'
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleServiceStarted(data: any): void {
    const incidentId = data?.incident_id;
    
    if (!incidentId) {
      console.warn('❌ service_started: payload incompleto', data);
      return;
    }

    console.log(`📨 Servicio iniciado para incidente ${incidentId}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'en_proceso',
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} marcado como en_proceso`);
    }
  }

  /**
   * ✅ Manejar finalización de servicio
   * Actualización parcial: actualiza estado del incidente a 'resuelto'
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleServiceCompleted(data: any): void {
    const incidentId = data?.incident_id;
    
    if (!incidentId) {
      console.warn('❌ service_completed: payload incompleto', data);
      return;
    }

    console.log(`📨 Servicio completado para incidente ${incidentId}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'resuelto',
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} marcado como resuelto`);
    }
  }

  /**
   * ✅ Manejar reasignación de incidente
   * Actualización parcial: actualiza taller asignado
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleIncidentReassigned(data: any): void {
    const incidentId = this.toInt(data?.incident_id);
    const newWorkshopId = this.toInt(data?.new_workshop_id);
    const previousWorkshopId = this.toInt(data?.previous_workshop_id);
    const newWorkshopName = data?.new_workshop_name;
    const reason = data?.reason;
    
    if (!incidentId || !newWorkshopId) {
      console.warn('❌ incident_reassigned: payload incompleto', data);
      return;
    }

    const currentUser = this.authService.currentUser();
    if (currentUser?.user_type === 'workshop') {
      const userWorkshopId = this.toInt(currentUser.workshop_id ?? currentUser.id);
      if (!userWorkshopId) {
        return;
      }

      if (previousWorkshopId === userWorkshopId && newWorkshopId !== userWorkshopId) {
        const filtered = this.incidentsSubject.value.filter(i => i.id !== incidentId);
        this.incidentsSubject.next(filtered);
        console.log(
          `Incidente ${incidentId} removido del taller ${userWorkshopId} ` +
          `(reasignado a taller ${newWorkshopId})`
        );
        return;
      }

      if (newWorkshopId !== userWorkshopId) {
        console.log(
          `Skipping incident_reassigned for workshop ${userWorkshopId}; ` +
          `new workshop is ${newWorkshopId}`
        );
        return;
      }
    }

    console.log(
      `📨 Incidente ${incidentId} reasignado a taller ${newWorkshopName} (${newWorkshopId}). ` +
      `Razón: ${reason || 'No especificada'}`
    );

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        taller_id: newWorkshopId,
        tecnico_id: null, // Resetear técnico al reasignar
        estado_actual: 'pendiente',
        estado_label: 'Pendiente',
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} reasignado a taller ${newWorkshopId}`);
    }
  }

  /**
   * ✅ Manejar técnico en camino
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleTechnicianOnWay(data: any): void {
    const incidentId = data?.incident_id;
    const technicianId = data?.technician_id;
    
    if (!incidentId || !technicianId) {
      console.warn('❌ technician_on_way: payload incompleto', data);
      return;
    }

    console.log(`📨 Técnico ${technicianId} en camino al incidente ${incidentId}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'en_camino',
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} actualizado: técnico en camino`);
    }
  }

  /**
   * ✅ Manejar trabajo iniciado
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleWorkStarted(data: any): void {
    const incidentId = data?.incident_id;
    const technicianId = data?.technician_id;
    
    if (!incidentId || !technicianId) {
      console.warn('❌ work_started: payload incompleto', data);
      return;
    }

    console.log(`📨 Trabajo iniciado en incidente ${incidentId} por técnico ${technicianId}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'en_proceso',
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incidente ${incidentId} actualizado: trabajo iniciado`);
    }
  }

  /**
   * ✅ Manejar trabajo completado
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleWorkCompleted(data: any): void {
    const incidentId = data?.incident_id;
    const technicianId = data?.technician_id;
    
    if (!incidentId) return;
    
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex((i: LegacyIncident) => i.id === incidentId);
    
    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        estado_actual: 'resuelto'
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incident ${incidentId} marked as completed`);
    }
  }

  /**
   * ✅ Manejar evento de sin taller disponible
   * Remueve el incidente de la vista de todos los talleres
   */
  private handleNoWorkshopAvailable(data: any): void {
    console.log('📨 No workshop available event:', data);
    
    const incidentId = this.toInt(data?.incident_id);
    if (!incidentId) return;
    
    // ✅ VALIDAR: Solo procesar si el usuario es un taller
    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident.no_workshop_available: user is not a workshop');
      return;
    }
    
    // ✅ Actualizar estado a sin_taller_disponible para que el componente lo filtre
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);
    
    if (index !== -1) {
      // Talleres no deben seguir visualizando la card cuando queda sin taller disponible.
      const filtered = incidents.filter(i => i.id !== incidentId);
      this.incidentsSubject.next(filtered);
      console.log(`🚫 Incidente ${incidentId} removido de la lista del taller (sin_taller_disponible)`);
    }
  }

  /**
   * Cargar incidentes inicialmente y actualizar estado
   */
  public async loadIncidents(): Promise<void> {
    this.loadingSubject.next(true);
    try {
      const incidents = await this.getIncidents();
      this.incidentsSubject.next(incidents);
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Actualizar un incidente específico en el estado
   */
  public updateIncidentInState(incident: LegacyIncident): void {
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incident.id);

    if (index !== -1) {
      incidents[index] = incident;
      this.incidentsSubject.next([...incidents]);
    }
  }

  /**
   * Remover un incidente del estado
   */
  public removeIncidentFromState(incidentId: number): void {
    const incidents = this.incidentsSubject.value;
    const filtered = incidents.filter(i => i.id !== incidentId);
    this.incidentsSubject.next(filtered);
  }

  /**
   * Obtiene todos los incidentes del usuario actual (legacy format)
   * @returns Promise with array of legacy incidents
   * @throws Error if request fails
   */
  async getIncidents(): Promise<LegacyIncident[]> {
    try {
      const response = await this.http.get<ApiResponse<LegacyIncident[]>>(this.apiUrl).toPromise();
      if (!response) {
        throw new Error('No response received from server');
      }
      void this.offlineCache.put('incidents', 'list', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
      if (!navigator.onLine) {
        const cached = await this.offlineCache.get<LegacyIncident[]>('incidents', 'list');
        if (cached) {
          console.log('📦 Loaded incidents from offline cache');
          return cached;
        }
        return [];
      }
      throw new Error(error?.error?.message || 'Error al cargar incidentes');
    }
  }

  /**
   * Obtiene todos los incidentes del usuario actual (new model format)
   * @returns Promise with array of incidents
   * @throws Error if request fails
   */
  async getIncidentsNewModel(): Promise<Incident[]> {
    try {
      const response = await this.http.get<ApiResponse<LegacyIncident[]>>(this.apiUrl).toPromise();
      if (!response) {
        throw new Error('No response received from server');
      }
      void this.offlineCache.put('incidents', 'list', response.data);
      return response.data.map(legacy => this.transformLegacyIncident(legacy));
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
      if (!navigator.onLine) {
        const cached = await this.offlineCache.get<LegacyIncident[]>('incidents', 'list');
        if (cached) {
          console.log('📦 Loaded incidents from offline cache');
          return cached.map(legacy => this.transformLegacyIncident(legacy));
        }
        return [];
      }
      throw new Error(error?.error?.message || 'Error al cargar incidentes');
    }
  }

  /**
   * Transform legacy incident format to new model format
   */
  public transformLegacyIncident(legacy: LegacyIncident): Incident {
    // Build categoria from categoria_ia string
    const categoria = legacy.categoria_ia
      ? { id: 0, nombre: legacy.categoria_ia, descripcion: '', icono: null as string | null }
      : undefined;

    // Build suggested_technician from legacy data
    let suggested: any = null;
    if (legacy.suggested_technician) {
      suggested = {
        technician_id: legacy.suggested_technician.technician_id,
        technician_name: legacy.suggested_technician.technician_name || '',
        distance_km: legacy.suggested_technician.distance_km || 0,
        compatibility_score: legacy.suggested_technician.compatibility_score || 0,
        timeout_at: (legacy.suggested_technician as any).timeout_at || '',
        assigned_at: legacy.assigned_at || legacy.created_at,
      };
    }

    // Build taller (workshop) from legacy data
    const taller = legacy.taller
      ? {
          id: legacy.taller.id,
          nombre: (legacy.taller as any).workshop_name || (legacy.taller as any).nombre || '',
          direccion: legacy.taller.direccion || '',
          telefono: legacy.taller.telefono || '',
          email: (legacy.taller as any).email || '',
          latitud: legacy.taller.latitud || 0,
          longitud: legacy.taller.longitud || 0,
        }
      : undefined;

    // Build tecnico (technician) from legacy data
    const tecnico = legacy.tecnico
      ? {
          id: legacy.tecnico.id,
          nombre: legacy.tecnico.nombre || '',
          apellido: legacy.tecnico.apellido || '',
          telefono: legacy.tecnico.telefono || '',
          especialidades: (legacy.tecnico as any).especialidades || [],
          taller_id: legacy.taller_id || 0,
          disponible: (legacy.tecnico as any).disponible ?? true,
        }
      : undefined;

    return {
      id: legacy.id,
      descripcion: legacy.descripcion,
      prioridad: this.mapPriority(legacy.prioridad_ia || legacy.prioridad_label),
      estado: this.mapStatus(legacy.estado_actual),
      cliente_id: legacy.cliente_id,
      cliente: legacy.cliente ? {
        id: legacy.cliente.id,
        nombre: legacy.cliente.nombre,
        apellido: legacy.cliente.apellido,
        email: legacy.cliente.email,
        telefono: legacy.cliente.telefono,
        created_at: legacy.cliente.created_at,
      } : undefined,
      vehiculo_id: legacy.vehiculo_id,
      vehiculo: legacy.vehiculo ? {
        id: legacy.vehiculo.id,
        marca: legacy.vehiculo.marca,
        modelo: legacy.vehiculo.modelo,
        anio: legacy.vehiculo.anio,
        placa: legacy.vehiculo.placa,
        color: (legacy.vehiculo as any).color || '',
        cliente_id: legacy.cliente_id,
      } : undefined,
      categoria_id: 0,
      categoria,
      taller_id: legacy.taller_id,
      taller,
      tecnico_id: legacy.tecnico_id,
      tecnico,
      ubicacion: legacy.direccion_referencia,
      latitud: legacy.latitud,
      longitud: legacy.longitud,
      direccion_referencia: legacy.direccion_referencia,
      suggested_technician: suggested,
      rejection_count: 0,
      has_timeout: false,
      timeout_at: (legacy as any).timeout_at || null,
      created_at: legacy.created_at,
      updated_at: legacy.updated_at,
      evidencias: undefined,
      ai_analysis: undefined,
    };
  }

  /**
   * Map legacy priority to new model priority
   */
  private mapPriority(priority: string | null): 'alta' | 'media' | 'baja' {
    if (!priority) return 'media';
    const lower = priority.toLowerCase();
    if (lower.includes('alta') || lower.includes('high')) return 'alta';
    if (lower.includes('baja') || lower.includes('low')) return 'baja';
    return 'media';
  }

  /**
   * Map legacy status to new model status
   */
  private mapStatus(status: string): 'pendiente' | 'asignado' | 'aceptado' | 'en_camino' | 'en_proceso' | 'resuelto' | 'cancelado' | 'sin_taller_disponible' {
    const statusMap: Record<string, any> = {
      'pendiente': 'pendiente',
      'pending': 'pendiente',
      'asignado': 'asignado',
      'assigned': 'asignado',
      'aceptado': 'aceptado',
      'accepted': 'aceptado',
      'en_camino': 'en_camino',
      'on_way': 'en_camino',
      'en_proceso': 'en_proceso',
      'in_progress': 'en_proceso',
      'resuelto': 'resuelto',
      'resolved': 'resuelto',
      'cancelado': 'cancelado',
      'cancelled': 'cancelado',
      'sin_taller_disponible': 'sin_taller_disponible',
      'sin_taller_asignado': 'sin_taller_disponible',
      'sin taller disponible': 'sin_taller_disponible',
      'sin taller asignado': 'sin_taller_disponible',
      'no_workshop_available': 'sin_taller_disponible'
    };
    return statusMap[status] || 'pendiente';
  }

  /**
   * Obtiene los incidentes pendientes de asignación (para talleres)
   */
  getPendingIncidents(): Observable<LegacyIncident[]> {
    return this.http.get<ApiResponse<LegacyIncident[]>>(`${this.apiUrl}/pendientes/asignacion`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene los incidentes sin taller disponible (para administradores)
   */
  getUnassignedIncidents(): Observable<LegacyIncident[]> {
    return this.http.get<ApiResponse<LegacyIncident[]>>(`${this.apiUrl}?estado=sin_taller_disponible`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene el detalle de un incidente específico
   * @param id - Incident ID
   * @returns Promise with incident details
   * @throws Error if request fails or incident not found
   */
  async getIncidentById(id: number): Promise<Incident> {
    try {
      const response = await this.http.get<ApiResponse<Incident>>(`${this.apiUrl}/${id}`).toPromise();
      if (!response) {
        throw new Error('No response received from server');
      }
      void this.offlineCache.put('incidents', `detail_${id}`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching incident ${id}:`, error);
      if (!navigator.onLine) {
        const cached = await this.offlineCache.get<Incident>('incidents', `detail_${id}`);
        if (cached) {
          console.log(`📦 Loaded incident ${id} from offline cache`);
          return cached;
        }
      }
      if (error?.status === 404) {
        throw new Error(`Incidente #${id} no encontrado`);
      }
      throw new Error(error?.error?.message || 'Error al cargar detalle del incidente');
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use getIncidentById instead
   */
  getIncidentDetail(id: number): Observable<LegacyIncident> {
    return this.http.get<ApiResponse<LegacyIncident>>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Acepta un incidente (para talleres)
   * @param id - Incident ID
   * @param technicianId - Technician ID (null for manual assignment later)
   * @returns Promise with acceptance response
   * @throws Error if request fails
   */
  async acceptIncident(id: number, technicianId: number | null): Promise<AcceptIncidentResponse> {
    try {
      const payload = technicianId ? { technician_id: technicianId } : {};
      const response = await this.http.post<ApiResponse<any>>(
        `${this.apiUrl}/${id}/aceptar`,
        payload
      ).toPromise();
      
      if (!response) {
        throw new Error('No response received from server');
      }
      
      return {
        success: true,
        incident: response.data,
        message: 'Incidente aceptado exitosamente'
      };
    } catch (error: any) {
      console.error(`Error accepting incident ${id}:`, error);
      if (error?.status === 409) {
        throw new Error('Este incidente ya fue aceptado por otro taller');
      }
      if (error?.status === 400) {
        throw new Error(error?.error?.message || 'Solicitud inválida');
      }
      throw new Error(error?.error?.message || 'Error al aceptar el incidente');
    }
  }

  /**
   * Rechaza un incidente (para talleres)
   * @param id - Incident ID
   * @param reason - Rejection reason (min 10 chars)
   * @returns Promise with rejection response
   * @throws Error if request fails or reason is invalid
   */
  async rejectIncident(id: number, reason: string): Promise<RejectIncidentResponse> {
    try {
      // Validate reason
      if (!reason || reason.trim().length < 10) {
        throw new Error('El motivo debe tener al menos 10 caracteres');
      }
      if (reason.length > 200) {
        throw new Error('El motivo no puede exceder 200 caracteres');
      }

      const response = await this.http.post<ApiResponse<any>>(
        `${this.apiUrl}/${id}/rechazar`,
        { motivo: reason.trim() }
      ).toPromise();
      
      if (!response) {
        throw new Error('No response received from server');
      }
      
      return {
        success: true,
        message: 'Incidente rechazado exitosamente'
      };
    } catch (error: any) {
      console.error(`Error rejecting incident ${id}:`, error);
      if (error?.status === 404) {
        throw new Error(`Incidente #${id} no encontrado`);
      }
      if (error?.status === 400) {
        throw new Error(error?.error?.message || 'Solicitud inválida');
      }
      throw new Error(error?.error?.message || 'Error al rechazar el incidente');
    }
  }

  /**
   * Obtiene el análisis de IA para un incidente
   * @param id - Incident ID
   * @returns Promise with AI analysis
   * @throws Error if request fails or analysis not available
   */
  async getAIAnalysis(id: number): Promise<AIAnalysis> {
    try {
      const response = await this.http.get<ApiResponse<IncidentAiAnalysis>>(
        `${this.apiUrl}/${id}/analisis-ia`
      ).toPromise();
      
      if (!response) {
        throw new Error('No response received from server');
      }

      const analysis = response.data;
      
      // Transform backend model to frontend AIAnalysis model
      return {
        id: analysis.id,
        incident_id: analysis.incident_id,
        analysis: analysis.summary || 'Análisis no disponible',
        suggested_category: analysis.category,
        suggested_priority: analysis.priority as 'alta' | 'media' | 'baja' | null,
        confidence_score: analysis.confidence || 0,
        processing_status: this.mapAIStatus(analysis.status),
        created_at: analysis.created_at
      };
    } catch (error: any) {
      console.error(`Error fetching AI analysis for incident ${id}:`, error);
      if (error?.status === 404) {
        throw new Error('Análisis de IA no disponible para este incidente');
      }
      throw new Error(error?.error?.message || 'Error al cargar análisis de IA');
    }
  }

  /**
   * Map backend AI status to frontend status
   */
  private mapAIStatus(status: IncidentAiAnalysisStatus): AIProcessingStatus {
    const statusMap: Record<IncidentAiAnalysisStatus, AIProcessingStatus> = {
      'pending': 'pending',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed'
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Actualiza el estado de un incidente
   */
  updateIncidentStatus(id: number, estado: string): Observable<LegacyIncident> {
    return this.http.patch<ApiResponse<LegacyIncident>>(`${this.apiUrl}/${id}/estado`, { estado }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Gets latest UC10 AI analysis for one incident.
   */
  getLatestIncidentAiAnalysis(id: number): Observable<IncidentAiAnalysis> {
    return this.http.get<ApiResponse<IncidentAiAnalysis>>(`${this.apiUrl}/${id}/analisis-ia`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Gets UC10 AI analysis history for one incident.
   */
  getIncidentAiAnalysisHistory(id: number): Observable<IncidentAiAnalysis[]> {
    return this.http.get<ApiResponse<IncidentAiAnalysis[]>>(`${this.apiUrl}/${id}/analisis-ia/historial`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Triggers UC10 AI processing (manual/admin endpoint).
   */
  processIncidentWithAi(id: number): Observable<IncidentAiAnalysis> {
    return this.http.post<ApiResponse<IncidentAiAnalysis>>(`${this.apiUrl}/${id}/procesar-ia`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Triggers UC10 AI reprocessing (manual/admin endpoint).
   */
  reprocessIncidentWithAi(id: number): Observable<IncidentAiAnalysis> {
    return this.http.post<ApiResponse<IncidentAiAnalysis>>(`${this.apiUrl}/${id}/reprocesar-ia`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Gets admin detail view with assignment history, rejections, and state history.
   */
  getIncidentAdminDetail(id: number): Observable<IncidentDetailAdmin> {
    return this.http.get<ApiResponse<IncidentDetailAdmin>>(`${this.apiUrl}/admin/${id}/detail`).pipe(
      map(response => response.data)
    );
  }
}
