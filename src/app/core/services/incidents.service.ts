import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { 
  Incident, 
  AIAnalysis,
  AcceptIncidentResponse,
  RejectIncidentResponse,
  AIProcessingStatus,
  Client,
  Vehicle,
  Workshop,
  Technician
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
  response_status: 'accepted' | 'rejected' | 'no_response' | 'timeout';
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
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  // Estado reactivo de incidentes
  private incidentsSubject = new BehaviorSubject<LegacyIncident[]>([]);
  public incidents$ = this.incidentsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  /** Emits whenever a new incident_assigned event arrives — components can subscribe to refresh counters */
  public readonly incidentAssigned$ = new Subject<any>();

  constructor() {
    this.subscribeToWebSocket();
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
    const incidentId = data?.incident_id ?? data?.data?.incident_id;
    const newStatus = data?.estado_actual ?? data?.new_status ?? data?.data?.estado_actual;
    const changedBy = data?.changed_by ?? data?.data?.changed_by;

    if (!incidentId || !newStatus) {
      console.warn('❌ incident_status_change: payload incompleto', data);
      return;
    }

    console.log(`📨 Cambio de estado recibido: incidente ${incidentId} → ${newStatus}`);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    // ✅ Si el incidente pasa a "sin_taller_disponible", removerlo de la lista
    // Solo el admin debe ver estos incidentes
    if (newStatus === 'sin_taller_disponible') {
      if (index !== -1) {
        console.log(`🚫 Incidente ${incidentId} pasó a sin_taller_disponible - removiendo de cache de taller`);
        // ✅ CORREGIDO: Usar filter() en vez de splice() para inmutabilidad
        const filtered = incidents.filter(i => i.id !== incidentId);
        this.incidentsSubject.next(filtered);
      }
      return;
    }

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      // ✅ CORREGIDO: Usar safeIncidentMerge para preservar campos críticos
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
    const incidentId = data?.incident_id;
    const updatedFields = data?.updated_fields;

    if (!incidentId || !updatedFields) {
      console.warn('❌ incident_updated: payload incompleto', data);
      return;
    }

    console.log(`📨 Actualización de incidente recibida: incidente ${incidentId}`, updatedFields);

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      // ✅ CORREGIDO: Usar safeIncidentMerge para preservar campos críticos
      updated[index] = safeIncidentMerge(updated[index], {
        ...updatedFields,
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
    const estadoActual = data?.estado_actual || 'en_proceso';

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
        estado_actual: 'en_sitio',
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
    const incidents = this.incidentsSubject.value;
    const exists = incidents.some(i => i.id === data.incident_id);

    if (!exists) {
      console.log(`📨 New incident ${data.incident_id} created, fetching complete data`);
      
      // Hacer fetch del incidente completo desde el servidor
      this.getIncidentDetail(data.incident_id).subscribe({
        next: (completeIncident) => {
          const currentIncidents = this.incidentsSubject.value;
          // Verificar que no se haya agregado mientras tanto
          if (!currentIncidents.some(i => i.id === data.incident_id)) {
            currentIncidents.unshift(completeIncident);
            this.incidentsSubject.next([...currentIncidents]);
            console.log(`✅ Complete incident ${data.incident_id} added to cache`);
          }
        },
        error: (error) => {
          console.error(`❌ Error fetching complete incident ${data.incident_id}:`, error);
          // Fallback: crear con datos básicos si falla el fetch
          const basicIncident: LegacyIncident = {
            id: data.incident_id,
            cliente_id: data.client_id || 0,
            vehiculo_id: data.vehiculo_id || 0,
            taller_id: null,
            tecnico_id: null,
            estado_actual: data.estado_actual || 'pendiente',
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
          
          const currentIncidents = this.incidentsSubject.value;
          if (!currentIncidents.some(i => i.id === data.incident_id)) {
            currentIncidents.unshift(basicIncident);
            this.incidentsSubject.next([...currentIncidents]);
            console.log(`⚠️ Basic incident ${data.incident_id} added to cache (fetch failed)`);
          }
        }
      });
    } else {
      console.log(`ℹ️ Incident ${data.incident_id} already exists in cache`);
    }
  }

  /**
   * Manejar incidente asignado a taller (notificación en tiempo real)
   * ✅ ACTUALIZACIÓN PARCIAL: Solo actualiza el incidente afectado sin refetch HTTP
   * ✅ CORREGIDO: Usa inmutabilidad completa
   */
  private handleIncidentAssigned(data: any): void {
    console.log('🔔 Incident assigned event received:', data);

    // ✅ VALIDAR: Solo procesar si el usuario es un taller
    const currentUser = this.authService.currentUser();
    
    // Debug: ver qué tiene el usuario
    console.log('👤 Current user:', currentUser);
    console.log('🏢 Workshop ID from user:', currentUser?.workshop_id);
    console.log('🆔 User ID:', currentUser?.id);
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident_assigned: user is not a workshop');
      return;
    }

    // ✅ VALIDAR: Solo procesar si el workshop_id coincide con el taller actual
    // Para usuarios tipo workshop, su ID es el workshop_id
    const userWorkshopId = currentUser.workshop_id || currentUser.id;
    
    if (data.workshop_id !== userWorkshopId) {
      console.log(
        `⏭️ Skipping incident_assigned: workshop_id ${data.workshop_id} ` +
        `does not match current workshop ${userWorkshopId}`
      );
      return;
    }

    console.log(`✅ Processing incident_assigned for workshop ${userWorkshopId}`);

    // ✅ Actualización parcial: agregar o actualizar el incidente en el estado local
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);

    if (index !== -1) {
      // ✅ CORREGIDO: Crear copia del array antes de modificar
      const updated = [...incidents];
      updated[index] = safeIncidentMerge(updated[index], {
        taller_id: data.workshop_id,
        estado_actual: data.estado_actual || data.new_status || updated[index].estado_actual,
        updated_at: data.timestamp || new Date().toISOString()
      });
      this.incidentsSubject.next(updated);
      console.log(`✅ Incident ${data.incident_id} updated in cache (assigned to workshop ${data.workshop_id})`);
    } else {
      // Si no está en cache, hacer fetch del incidente completo
      console.log(`ℹ️ Incidente ${data.incident_id} no encontrado en cache, haciendo fetch completo`);
      this.getIncidentById(data.incident_id).then(incident => {
        const currentIncidents = this.incidentsSubject.value;
        
        // Convertir Incident a LegacyIncident
        const legacyIncident: LegacyIncident = {
          id: incident.id,
          cliente_id: incident.cliente_id,
          vehiculo_id: incident.vehiculo_id,
          taller_id: incident.taller_id,
          tecnico_id: incident.tecnico_id,
          estado_actual: incident.estado,
          estado_label: incident.estado,
          descripcion: incident.descripcion,
          latitud: incident.latitud,
          longitud: incident.longitud,
          direccion_referencia: incident.direccion_referencia,
          categoria_ia: incident.ai_analysis?.suggested_category || null,
          prioridad_ia: incident.ai_analysis?.suggested_priority || null,
          prioridad_label: incident.ai_analysis?.suggested_priority || 'media',
          created_at: incident.created_at,
          updated_at: incident.updated_at,
          resumen_ia: incident.ai_analysis?.analysis || null,
          es_ambiguo: false,
          assigned_at: null,
          cliente: incident.cliente,
          vehiculo: incident.vehiculo,
          taller: incident.taller || null,
          tecnico: incident.tecnico || null,
          // ✅ Incluir suggested_technician del backend
          suggested_technician: incident.suggested_technician ? {
            technician_id: incident.suggested_technician.technician_id,
            technician_name: incident.suggested_technician.technician_name,
            distance_km: incident.suggested_technician.distance_km,
            compatibility_score: incident.suggested_technician.compatibility_score
          } : null
        };
        
        // Asegurar que tenga los datos de asignación actualizados
        legacyIncident.taller_id = data.workshop_id;
        legacyIncident.estado_actual = data.estado_actual || data.new_status || legacyIncident.estado_actual;
        legacyIncident.updated_at = data.timestamp || new Date().toISOString();
        
        // ✅ CORREGIDO: Crear nuevo array en vez de mutar
        const updatedList = [legacyIncident, ...currentIncidents];
        this.incidentsSubject.next(updatedList);
        console.log(`✅ Incidente ${data.incident_id} agregado al cache después de fetch completo con suggested_technician`);
      }).catch(error => {
        console.error(`❌ Error fetching incident ${data.incident_id}:`, error);
        // Fallback: crear incidente básico si falla el fetch
        const newIncident: LegacyIncident = {
          id: data.incident_id,
          cliente_id: data.client_id || 0,
          vehiculo_id: data.vehiculo_id || 0,
          taller_id: data.workshop_id,
          tecnico_id: null,
          estado_actual: data.estado_actual || data.new_status || 'pendiente',
          estado_label: 'Asignado',
          descripcion: data.descripcion || 'Descripción no disponible',
          latitud: data.latitude || 0,
          longitud: data.longitude || 0,
          direccion_referencia: data.direccion_referencia || null,
          categoria_ia: data.categoria_ia || null,
          prioridad_ia: data.prioridad_ia || null,
          prioridad_label: data.prioridad_ia || 'Media',
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.timestamp || new Date().toISOString(),
          suggested_technician: null
        };
        const currentIncidents = this.incidentsSubject.value;
        // ✅ CORREGIDO: Crear nuevo array en vez de mutar
        const updatedList = [newIncident, ...currentIncidents];
        this.incidentsSubject.next(updatedList);
        console.log(`⚠️ Incidente ${data.incident_id} agregado con datos básicos (fetch falló)`);
      });
    }

    // Notificar a los componentes suscritos para que recarguen contadores
    this.incidentAssigned$.next(data);

    // Mostrar notificación visual al usuario
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Nueva solicitud de servicio', {
          body: `Incidente #${data.incident_id} - ${data.categoria_ia || 'Sin categoría'}`,
          icon: '/logo.png',
          tag: `incident-${data.incident_id}`
        });
      } catch (error) {
        console.warn('Failed to show notification:', error);
      }
    }
  }

  /**
   * Manejar aceptación de asignación por un taller
   * ✅ CORREGIDO: Si otro taller aceptó, remover el incidente de la vista del taller actual
   * Si este taller aceptó, actualizar el estado
   */
  private handleAssignmentAccepted(data: any): void {
    console.log('✅ Assignment accepted event received:', data);

    // ✅ VALIDAR: Solo procesar si el usuario es un taller
    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident_assignment_accepted: user is not a workshop');
      return;
    }

    const userWorkshopId = currentUser.workshop_id || currentUser.id;
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);

    // ✅ Si OTRO taller aceptó el incidente, removerlo de la vista de este taller
    if (data.workshop_id !== userWorkshopId) {
      if (index !== -1) {
        const filtered = incidents.filter(i => i.id !== data.incident_id);
        this.incidentsSubject.next(filtered);
        console.log(
          `🚫 Incidente ${data.incident_id} removido de la vista del taller ${userWorkshopId} ` +
          `(aceptado por taller ${data.workshop_id})`
        );
      }
    } else {
      // ✅ Si ESTE taller aceptó, actualizar el estado
      if (index !== -1) {
        const updated = [...incidents];
        updated[index] = safeIncidentMerge(updated[index], {
          taller_id: data.workshop_id,
          estado_actual: updated[index].estado_actual === 'pendiente' ? 'asignado' : updated[index].estado_actual,
          updated_at: data.timestamp || new Date().toISOString()
        });
        this.incidentsSubject.next(updated);
        console.log(
          `✅ Incident ${data.incident_id} accepted by THIS workshop ${data.workshop_name} (id: ${data.workshop_id})`
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

    // Log for admin dashboard visibility
    console.warn(
      `⚠️ Workshop ${data.workshop_name} (id: ${data.workshop_id}) rejected incident ${data.incident_id}. ` +
      `Reason: ${data.rejection_reason || 'No reason provided'}`
    );

    // ✅ VALIDAR: Solo procesar si el usuario es el taller que rechazó
    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident_assignment_rejected: user is not a workshop');
      return;
    }

    const userWorkshopId = currentUser.workshop_id || currentUser.id;
    
    // ✅ Si este taller rechazó el incidente, removerlo de su vista
    if (data.workshop_id === userWorkshopId) {
      const incidents = this.incidentsSubject.value;
      const filtered = incidents.filter(i => i.id !== data.incident_id);
      
      if (filtered.length !== incidents.length) {
        this.incidentsSubject.next(filtered);
        console.log(`🚫 Incidente ${data.incident_id} removido de la vista del taller ${userWorkshopId} (rechazado)`);
      }
    } else {
      // Si es otro taller, solo actualizar timestamp
      const incidents = this.incidentsSubject.value;
      const index = incidents.findIndex(i => i.id === data.incident_id);

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

    // Log for admin dashboard visibility
    console.warn(
      `⏰ Assignment attempt timed out for incident ${data.incident_id} ` +
      `(workshop: ${data.workshop_name}, id: ${data.workshop_id})`
    );

    try {
      // Fetch the updated incident to get its current state
      // Don't just remove it - it might have been reassigned or changed state
      const updatedIncident = await this.getIncidentById(data.incident_id);
      
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
        estado_actual: updatedIncident.estado,
        estado_label: updatedIncident.estado,
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
      
      // Update the incident in the cache
      const incidents = this.incidentsSubject.value;
      const index = incidents.findIndex(i => i.id === data.incident_id);
      
      if (index !== -1) {
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
    const incidentId = data?.incident_id;
    if (!incidentId) return;

    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === incidentId);

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
    const incidentId = data?.incident_id;
    const newWorkshopId = data?.new_workshop_id;
    const newWorkshopName = data?.new_workshop_name;
    const reason = data?.reason;
    
    if (!incidentId || !newWorkshopId) {
      console.warn('❌ incident_reassigned: payload incompleto', data);
      return;
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
        estado_actual: 'asignado',
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
    
    const incidentId = data?.incident_id;
    if (!incidentId) return;
    
    // ✅ VALIDAR: Solo procesar si el usuario es un taller
    const currentUser = this.authService.currentUser();
    
    if (!currentUser || currentUser.user_type !== 'workshop') {
      console.log('⏭️ Skipping incident.no_workshop_available: user is not a workshop');
      return;
    }
    
    // ✅ Remover el incidente de la vista del taller
    const incidents = this.incidentsSubject.value;
    const filtered = incidents.filter(i => i.id !== incidentId);
    
    if (filtered.length !== incidents.length) {
      this.incidentsSubject.next(filtered);
      console.log(`🚫 Incidente ${incidentId} removido de la vista (sin taller disponible)`);
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
      return response.data;
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
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
      // Transform legacy incidents to new model
      return response.data.map(legacy => this.transformLegacyIncident(legacy));
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
      throw new Error(error?.error?.message || 'Error al cargar incidentes');
    }
  }

  /**
   * Transform legacy incident format to new model format
   */
  private transformLegacyIncident(legacy: LegacyIncident): Incident {
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
        created_at: legacy.cliente.created_at
      } : undefined,
      vehiculo_id: legacy.vehiculo_id,
      vehiculo: legacy.vehiculo ? {
        id: legacy.vehiculo.id,
        marca: legacy.vehiculo.marca,
        modelo: legacy.vehiculo.modelo,
        anio: legacy.vehiculo.anio,
        placa: legacy.vehiculo.placa,
        color: '', // Default value, should come from backend
        cliente_id: legacy.cliente_id
      } : undefined,
      categoria_id: 1, // Default category, should come from backend
      categoria: undefined, // Should come from backend
      taller_id: legacy.taller_id,
      taller: undefined, // Should come from backend
      tecnico_id: legacy.tecnico_id,
      tecnico: undefined, // Should come from backend
      ubicacion: legacy.direccion_referencia,
      latitud: legacy.latitud,
      longitud: legacy.longitud,
      direccion_referencia: legacy.direccion_referencia,
      suggested_technician: null, // Should come from backend if available
      rejection_count: 0,
      has_timeout: false,
      timeout_at: null,
      created_at: legacy.created_at,
      updated_at: legacy.updated_at,
      evidencias: undefined, // Should come from backend
      ai_analysis: undefined // Should come from backend
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
      'asignado': 'asignado',
      'aceptado': 'aceptado',
      'en_camino': 'en_camino',
      'en_proceso': 'en_proceso',
      'resuelto': 'resuelto',
      'cancelado': 'cancelado',
      'sin_taller_disponible': 'sin_taller_disponible'
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
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching incident ${id}:`, error);
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
