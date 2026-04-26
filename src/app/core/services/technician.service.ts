import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { WebSocketService } from './websocket.service';

export interface TechnicianSpecialty {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface Technician {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  workshop_id: number;
  current_latitude: number | null;
  current_longitude: number | null;
  location_updated_at: string | null;
  location_accuracy: number | null;
  is_available: boolean;
  is_on_duty: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  especialidades?: TechnicianSpecialty[];
}

export interface TechnicianWorkload {
  technician_id: number;
  is_available: boolean;
  is_online: boolean;
  active_incidents: number;
  active_tracking_sessions: number;
  has_active_work: boolean;
}

export interface TechnicianStatistics {
  technician_id: number;
  total_incidents: number;
  resolved_incidents: number;
  cancelled_incidents: number;
  active_incidents: number;
  resolution_rate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface CreateTechnicianRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  workshop_id: number;
  current_latitude?: number | null;
  current_longitude?: number | null;
  is_available?: boolean;
  specialty_ids?: number[];
}

export interface UpdateTechnicianRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_available?: boolean;
  specialty_ids?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class TechnicianService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/technicians`;

  // Estado reactivo de técnicos
  private techniciansSubject = new BehaviorSubject<Technician[]>([]);
  public technicians$ = this.techniciansSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Suscribirse a eventos WebSocket para actualizaciones en tiempo real
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'technician_availability_changed':
          this.handleTechnicianAvailabilityChanged(message.data);
          break;
        case 'technician_duty_started':
          this.handleTechnicianDutyStarted(message.data);
          break;
        case 'technician_duty_ended':
          this.handleTechnicianDutyEnded(message.data);
          break;
        case 'technician_updated':
          this.handleTechnicianUpdated(message.data);
          break;
      }
    });
  }

  /**
   * Manejar cambio de disponibilidad de técnico
   */
  private handleTechnicianAvailabilityChanged(data: any): void {
    const technicians = this.techniciansSubject.value;
    const index = technicians.findIndex(t => t.id === data.technician_id);
    
    if (index !== -1) {
      technicians[index] = {
        ...technicians[index],
        is_available: data.is_available,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.techniciansSubject.next([...technicians]);
      console.log(`✅ Technician ${data.technician_id} availability updated to ${data.is_available}`);
    }
  }

  /**
   * Manejar inicio de turno de técnico
   */
  private handleTechnicianDutyStarted(data: any): void {
    const technicians = this.techniciansSubject.value;
    const index = technicians.findIndex(t => t.id === data.technician_id);
    
    if (index !== -1) {
      technicians[index] = {
        ...technicians[index],
        is_on_duty: true,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.techniciansSubject.next([...technicians]);
      console.log(`✅ Technician ${data.first_name} ${data.last_name} started duty`);
    }
  }

  /**
   * Manejar fin de turno de técnico
   */
  private handleTechnicianDutyEnded(data: any): void {
    const technicians = this.techniciansSubject.value;
    const index = technicians.findIndex(t => t.id === data.technician_id);
    
    if (index !== -1) {
      technicians[index] = {
        ...technicians[index],
        is_on_duty: false,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.techniciansSubject.next([...technicians]);
      console.log(`✅ Technician ${data.first_name} ${data.last_name} ended duty`);
    }
  }

  /**
   * Manejar actualización de perfil de técnico
   */
  private handleTechnicianUpdated(data: any): void {
    const technicians = this.techniciansSubject.value;
    const index = technicians.findIndex(t => t.id === data.technician_id);
    
    if (index !== -1) {
      // Actualizar solo los campos que vienen en el evento
      technicians[index] = {
        ...technicians[index],
        first_name: data.first_name ?? technicians[index].first_name,
        last_name: data.last_name ?? technicians[index].last_name,
        is_available: data.is_available ?? technicians[index].is_available,
        is_on_duty: data.is_on_duty ?? technicians[index].is_on_duty,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.techniciansSubject.next([...technicians]);
      console.log(`✅ Technician ${data.technician_id} profile updated`);
    }
  }

  /**
   * Cargar técnicos inicialmente y actualizar estado
   */
  public loadTechnicians(workshopId: number, includeUnavailable = true): void {
    this.loadingSubject.next(true);
    this.getTechniciansByWorkshop(workshopId, includeUnavailable).subscribe({
      next: (technicians) => {
        this.techniciansSubject.next(technicians);
        this.loadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading technicians:', error);
        this.loadingSubject.next(false);
      }
    });
  }

  /**
   * Actualizar un técnico específico en el estado
   */
  public updateTechnicianInState(technician: Technician): void {
    const technicians = this.techniciansSubject.value;
    const index = technicians.findIndex(t => t.id === technician.id);
    
    if (index !== -1) {
      technicians[index] = technician;
      this.techniciansSubject.next([...technicians]);
    }
  }

  /**
   * Remover un técnico del estado
   */
  public removeTechnicianFromState(technicianId: number): void {
    const technicians = this.techniciansSubject.value;
    const filtered = technicians.filter(t => t.id !== technicianId);
    this.techniciansSubject.next(filtered);
  }

  getTechniciansByWorkshop(workshopId: number, includeUnavailable = true): Observable<Technician[]> {
    let params = new HttpParams();
    params = params.set('include_unavailable', includeUnavailable.toString());

    return this.http
      .get<ApiResponse<{ workshop_id: number; count: number; technicians: Technician[] }>>(
        `${this.apiUrl}/workshops/${workshopId}/all`,
        { params }
      )
      .pipe(map(response => response.data.technicians));
  }

  getAvailableTechnicians(workshopId: number, specialtyId?: number): Observable<Technician[]> {
    let params = new HttpParams();
    if (specialtyId) {
      params = params.set('specialty_id', specialtyId.toString());
    }

    return this.http
      .get<ApiResponse<{ workshop_id: number; specialty_id: number | null; count: number; technicians: Technician[] }>>(
        `${this.apiUrl}/workshops/${workshopId}/available`,
        { params }
      )
      .pipe(map(response => response.data.technicians));
  }

  getTechnicianById(technicianId: number): Observable<Technician> {
    return this.http
      .get<ApiResponse<Technician>>(`${environment.apiUrl}/users/technicians/${technicianId}`)
      .pipe(map(response => response.data));
  }

  createTechnician(data: CreateTechnicianRequest): Observable<Technician> {
    return this.http
      .post<ApiResponse<{ user: Technician; tokens: any }>>(`${environment.apiUrl}/auth/register/technician`, data)
      .pipe(map(response => response.data.user));
  }

  updateTechnician(technicianId: number, data: UpdateTechnicianRequest): Observable<Technician> {
    return this.http
      .patch<ApiResponse<Technician>>(`${environment.apiUrl}/users/technicians/${technicianId}`, data)
      .pipe(map(response => response.data));
  }

  deleteTechnician(technicianId: number): Observable<void> {
    return this.http
      .patch<ApiResponse<any>>(`${environment.apiUrl}/users/${technicianId}/deactivate`, {})
      .pipe(map(() => undefined));
  }

  updateAvailability(technicianId: number, isAvailable: boolean): Observable<void> {
    return this.http
      .patch<ApiResponse<any>>(`${this.apiUrl}/${technicianId}/availability`, {
        is_available: isAvailable
      })
      .pipe(map(() => undefined));
  }

  getTechnicianWorkload(technicianId: number): Observable<TechnicianWorkload> {
    return this.http
      .get<TechnicianWorkload>(`${this.apiUrl}/${technicianId}/workload`);
  }

  getTechnicianStatistics(
    technicianId: number,
    startDate?: string,
    endDate?: string
  ): Observable<TechnicianStatistics> {
    let params = new HttpParams();
    if (startDate) {
      params = params.set('start_date', startDate);
    }
    if (endDate) {
      params = params.set('end_date', endDate);
    }

    return this.http
      .get<TechnicianStatistics>(`${this.apiUrl}/${technicianId}/statistics`, { params });
  }

  assignSpecialty(technicianId: number, specialtyId: number): Observable<void> {
    return this.http
      .post<ApiResponse<any>>(`${this.apiUrl}/${technicianId}/specialties`, {
        specialty_id: specialtyId
      })
      .pipe(map(() => undefined));
  }

  removeSpecialty(technicianId: number, specialtyId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<any>>(`${this.apiUrl}/${technicianId}/specialties/${specialtyId}`)
      .pipe(map(() => undefined));
  }
}
