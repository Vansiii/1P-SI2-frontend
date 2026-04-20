import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { WebSocketService } from './websocket.service';

export interface Incident {
  id: number;
  cliente_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  estado_actual: string;
  estado_label: string;
  descripcion: string;
  latitud: number;
  longitud: number;
  direccion_referencia: string | null;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  prioridad_label: string;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  vehiculo?: {
    id: number;
    marca: string;
    modelo: string;
    anio: number;
    placa: string;
  };
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
  latitude: number;
  longitude: number;
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
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  // Estado reactivo de incidentes
  private incidentsSubject = new BehaviorSubject<Incident[]>([]);
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
        case 'incident_status_change':
          this.handleIncidentStatusChange(message.data);
          break;
        case 'technician_assigned':
          this.handleTechnicianAssigned(message.data);
          break;
        case 'technician_arrived':
          this.handleTechnicianArrived(message.data);
          break;
        case 'incident_created':
          this.handleIncidentCreated(message.data);
          break;
        case 'incident_assigned':
          this.handleIncidentAssigned(message.data);
          break;
        case 'assignment_accepted':
          this.handleAssignmentAccepted(message.data);
          break;
        case 'assignment_rejected':
          this.handleAssignmentRejected(message.data);
          break;
        case 'assignment_timeout':
          this.handleAssignmentTimeout(message.data);
          break;
      }
    });
  }

  /**
   * Manejar cambio de estado de incidente
   */
  private handleIncidentStatusChange(data: any): void {
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);
    
    if (index !== -1) {
      incidents[index] = {
        ...incidents[index],
        estado_actual: data.new_status,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.incidentsSubject.next([...incidents]);
      console.log(`✅ Incident ${data.incident_id} status updated to ${data.new_status}`);
    }
  }

  /**
   * Manejar asignación de técnico
   */
  private handleTechnicianAssigned(data: any): void {
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);
    
    if (index !== -1) {
      incidents[index] = {
        ...incidents[index],
        tecnico_id: data.technician.id,
        estado_actual: 'asignado',
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.incidentsSubject.next([...incidents]);
      console.log(`✅ Technician ${data.technician.name} assigned to incident ${data.incident_id}`);
    }
  }

  /**
   * Manejar llegada de técnico
   */
  private handleTechnicianArrived(data: any): void {
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);
    
    if (index !== -1) {
      incidents[index] = {
        ...incidents[index],
        estado_actual: 'en_sitio',
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.incidentsSubject.next([...incidents]);
      console.log(`✅ Technician arrived at incident ${data.incident_id}`);
    }
  }

  /**
   * Manejar nuevo incidente creado
   */
  private handleIncidentCreated(data: any): void {
    const incidents = this.incidentsSubject.value;
    const exists = incidents.some(i => i.id === data.id);
    
    if (!exists) {
      incidents.unshift(data); // Agregar al inicio
      this.incidentsSubject.next([...incidents]);
      console.log(`✅ New incident ${data.id} added to list`);
    }
  }

  /**
   * Manejar incidente asignado a taller (notificación en tiempo real)
   */
  private handleIncidentAssigned(data: any): void {
    console.log('🔔 Incident assigned event received:', data);
    
    // Recargar la lista de incidentes para obtener los datos actualizados
    this.loadIncidents();
    
    // Notificar a los componentes suscritos para que recarguen contadores
    this.incidentAssigned$.next(data);
    
    // Mostrar notificación visual al usuario
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nueva solicitud de servicio', {
        body: `Incidente #${data.incident_id} - ${data.categoria_ia || 'Sin categoría'}`,
        icon: '/assets/icons/icon-192x192.png',
        tag: `incident-${data.incident_id}`
      });
    }
  }

  /**
   * Manejar aceptación de asignación por un taller
   * Actualiza taller_id y estado_actual del incidente en el estado local
   */
  private handleAssignmentAccepted(data: any): void {
    console.log('✅ Assignment accepted event received:', data);
    
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);
    
    if (index !== -1) {
      incidents[index] = {
        ...incidents[index],
        taller_id: data.workshop_id,
        estado_actual: incidents[index].estado_actual === 'pendiente' ? 'asignado' : incidents[index].estado_actual,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.incidentsSubject.next([...incidents]);
      console.log(
        `✅ Incident ${data.incident_id} accepted by workshop ${data.workshop_name} (id: ${data.workshop_id})`
      );
    }
  }

  /**
   * Manejar rechazo de asignación por un taller
   * Actualiza indicadores de estado en el dashboard de administración
   */
  private handleAssignmentRejected(data: any): void {
    console.log('❌ Assignment rejected event received:', data);
    
    // Log for admin dashboard visibility
    console.warn(
      `⚠️ Workshop ${data.workshop_name} (id: ${data.workshop_id}) rejected incident ${data.incident_id}. ` +
      `Reason: ${data.rejection_reason || 'No reason provided'}`
    );
    
    // Update incident state if found - incident remains pending for reassignment
    const incidents = this.incidentsSubject.value;
    const index = incidents.findIndex(i => i.id === data.incident_id);
    
    if (index !== -1) {
      incidents[index] = {
        ...incidents[index],
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.incidentsSubject.next([...incidents]);
    }
  }

  /**
   * Manejar timeout de asignación
   * Actualiza indicadores de estado en el dashboard de administración
   * y remueve el incidente de la lista de pendientes del taller
   */
  private handleAssignmentTimeout(data: any): void {
    console.log('⏰ Assignment timeout event received:', data);
    
    // Log for admin dashboard visibility
    console.warn(
      `⏰ Assignment attempt timed out for incident ${data.incident_id} ` +
      `(workshop: ${data.workshop_name}, id: ${data.workshop_id})`
    );
    
    // Remove the incident from the list (it's no longer pending for this workshop)
    const incidents = this.incidentsSubject.value;
    const filteredIncidents = incidents.filter(i => i.id !== data.incident_id);
    
    if (filteredIncidents.length !== incidents.length) {
      this.incidentsSubject.next(filteredIncidents);
      console.log(`✅ Incident ${data.incident_id} removed from pending list due to timeout`);
    }
  }

  /**
   * Cargar incidentes inicialmente y actualizar estado
   */
  public loadIncidents(): void {
    this.loadingSubject.next(true);
    this.getIncidents().subscribe({
      next: (incidents) => {
        this.incidentsSubject.next(incidents);
        this.loadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading incidents:', error);
        this.loadingSubject.next(false);
      }
    });
  }

  /**
   * Actualizar un incidente específico en el estado
   */
  public updateIncidentInState(incident: Incident): void {
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
   * Obtiene todos los incidentes del usuario actual
   */
  getIncidents(): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(this.apiUrl).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene los incidentes pendientes de asignación (para talleres)
   */
  getPendingIncidents(): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}/pendientes/asignacion`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene los incidentes sin taller disponible (para administradores)
   */
  getUnassignedIncidents(): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}?estado=sin_taller_disponible`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene el detalle de un incidente específico
   */
  getIncidentDetail(id: number): Observable<Incident> {
    return this.http.get<ApiResponse<Incident>>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Acepta un incidente (para talleres)
   */
  acceptIncident(id: number): Observable<Incident> {
    return this.http.post<ApiResponse<Incident>>(`${this.apiUrl}/${id}/aceptar`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Rechaza un incidente (para talleres)
   */
  rejectIncident(id: number, motivo: string): Observable<Incident> {
    return this.http.post<ApiResponse<Incident>>(`${this.apiUrl}/${id}/rechazar`, { motivo }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Actualiza el estado de un incidente
   */
  updateIncidentStatus(id: number, estado: string): Observable<Incident> {
    return this.http.patch<ApiResponse<Incident>>(`${this.apiUrl}/${id}/estado`, { estado }).pipe(
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
