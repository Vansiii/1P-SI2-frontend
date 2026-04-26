import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { WebSocketService } from './websocket.service';

export interface Workshop {
  id: number;
  email: string;
  workshop_name: string;
  owner_name: string;
  is_available: boolean;
  is_verified: boolean;
  is_active: boolean;
  latitude: number;
  longitude: number;
  coverage_radius_km: number;
  created_at: string;
  updated_at: string;
}

export interface WorkshopBalance {
  workshop_id: number;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface WorkshopApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface WorkshopListResponse {
  users: Workshop[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UpdateWorkshopRequest {
  workshop_name?: string;
  owner_name?: string;
  is_available?: boolean;
  coverage_radius_km?: number;
  latitude?: number;
  longitude?: number;
}

export interface UpdateWorkshopBalanceRequest {
  available_balance?: number;
  pending_balance?: number;
  total_earned?: number;
  total_withdrawn?: number;
}

// WebSocket event payload interfaces
interface WorkshopAvailabilityChangedPayload {
  workshop_id: number;
  workshop_name: string;
  is_available: boolean;
  is_verified: boolean;
  timestamp: string;
}

interface WorkshopVerifiedPayload {
  workshop_id: number;
  workshop_name: string;
  is_available: boolean;
  is_verified: boolean;
  timestamp: string;
}

interface WorkshopUpdatedPayload {
  workshop_id: number;
  workshop_name: string;
  is_available: boolean;
  is_verified: boolean;
  timestamp: string;
}

interface WorkshopBalanceUpdatedPayload {
  workshop_id: number;
  workshop_name: string;
  is_available: boolean;
  is_verified: boolean;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkshopsService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  // Reactive state for workshops
  private workshopsSubject = new BehaviorSubject<Workshop[]>([]);
  public workshops$ = this.workshopsSubject.asObservable();

  // Reactive state for workshop balances
  private workshopBalancesSubject = new BehaviorSubject<Map<number, WorkshopBalance>>(new Map());
  public workshopBalances$ = this.workshopBalancesSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Subscribe to WebSocket events for real-time workshop updates
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'workshop_availability_changed':
          this.handleWorkshopAvailabilityChanged(message.data);
          break;
        case 'workshop_verified':
          this.handleWorkshopVerified(message.data);
          break;
        case 'workshop_updated':
          this.handleWorkshopUpdated(message.data);
          break;
        case 'workshop_balance_updated':
          this.handleWorkshopBalanceUpdated(message.data);
          break;
      }
    });
  }

  /**
   * Handle workshop availability change event
   * Updates is_available and is_verified on the matching workshop
   */
  private handleWorkshopAvailabilityChanged(data: WorkshopAvailabilityChangedPayload): void {
    const workshops = this.workshopsSubject.value;
    const index = workshops.findIndex(w => w.id === data.workshop_id);

    if (index !== -1) {
      const updated = [...workshops];
      updated[index] = {
        ...updated[index],
        is_available: data.is_available,
        is_verified: data.is_verified,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.workshopsSubject.next(updated);
      console.log(`✅ Workshop ${data.workshop_id} availability updated to ${data.is_available}`);
    }
  }

  /**
   * Handle workshop verified event
   * Updates is_verified status badge in real-time
   */
  private handleWorkshopVerified(data: WorkshopVerifiedPayload): void {
    const workshops = this.workshopsSubject.value;
    const index = workshops.findIndex(w => w.id === data.workshop_id);

    if (index !== -1) {
      const updated = [...workshops];
      updated[index] = {
        ...updated[index],
        is_verified: data.is_verified,
        is_available: data.is_available,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.workshopsSubject.next(updated);
      console.log(`✅ Workshop ${data.workshop_id} verification status updated to ${data.is_verified}`);
    }
  }

  /**
   * Handle workshop profile update event
   * Updates workshop_name and other fields from the payload
   */
  private handleWorkshopUpdated(data: WorkshopUpdatedPayload): void {
    const workshops = this.workshopsSubject.value;
    const index = workshops.findIndex(w => w.id === data.workshop_id);

    if (index !== -1) {
      const updated = [...workshops];
      updated[index] = {
        ...updated[index],
        workshop_name: data.workshop_name ?? updated[index].workshop_name,
        is_available: data.is_available ?? updated[index].is_available,
        is_verified: data.is_verified ?? updated[index].is_verified,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.workshopsSubject.next(updated);
      console.log(`✅ Workshop ${data.workshop_id} profile updated`);
    }
  }

  /**
   * Handle workshop balance update event
   * Updates the balance map for the affected workshop
   */
  private handleWorkshopBalanceUpdated(data: WorkshopBalanceUpdatedPayload): void {
    // Update workshop status fields in the workshops list
    const workshops = this.workshopsSubject.value;
    const index = workshops.findIndex(w => w.id === data.workshop_id);

    if (index !== -1) {
      const updated = [...workshops];
      updated[index] = {
        ...updated[index],
        is_available: data.is_available ?? updated[index].is_available,
        is_verified: data.is_verified ?? updated[index].is_verified,
        updated_at: data.timestamp || new Date().toISOString()
      };
      this.workshopsSubject.next(updated);
    }

    // Update the balance map
    const balances = new Map(this.workshopBalancesSubject.value);
    balances.set(data.workshop_id, {
      workshop_id: data.workshop_id,
      available_balance: data.available_balance,
      pending_balance: data.pending_balance,
      total_earned: data.total_earned,
      total_withdrawn: data.total_withdrawn
    });
    this.workshopBalancesSubject.next(balances);
    console.log(`✅ Workshop ${data.workshop_id} balance updated`);
  }

  /**
   * Load all workshops and populate the BehaviorSubject
   */
  public loadWorkshops(params?: { active_only?: boolean; skip?: number; limit?: number }): void {
    this.loadingSubject.next(true);
    this.getWorkshops(params).subscribe({
      next: (response) => {
        this.workshopsSubject.next(response.users);
        this.loadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error loading workshops:', error);
        this.loadingSubject.next(false);
      }
    });
  }

  /**
   * Update a single workshop in the BehaviorSubject state
   */
  public updateWorkshopInState(workshop: Workshop): void {
    const workshops = this.workshopsSubject.value;
    const index = workshops.findIndex(w => w.id === workshop.id);

    if (index !== -1) {
      const updated = [...workshops];
      updated[index] = workshop;
      this.workshopsSubject.next(updated);
    }
  }

  // ─── HTTP Methods ────────────────────────────────────────────────────────────

  /**
   * Fetch paginated list of workshops from the API
   */
  getWorkshops(params?: {
    active_only?: boolean;
    skip?: number;
    limit?: number;
  }): Observable<WorkshopListResponse> {
    let httpParams = new HttpParams().set('user_type', 'workshop');

    if (params) {
      if (params.active_only !== undefined) {
        httpParams = httpParams.set('active_only', String(params.active_only));
      }
      if (params.skip !== undefined) {
        httpParams = httpParams.set('skip', String(params.skip));
      }
      if (params.limit !== undefined) {
        httpParams = httpParams.set('limit', String(params.limit));
      }
    }

    return this.http
      .get<WorkshopApiResponse<WorkshopListResponse>>(`${this.apiUrl}`, { params: httpParams })
      .pipe(map(response => response.data));
  }

  /**
   * Fetch a single workshop by ID
   */
  getWorkshopById(workshopId: number): Observable<Workshop> {
    return this.http
      .get<WorkshopApiResponse<Workshop>>(`${this.apiUrl}/workshops/${workshopId}`)
      .pipe(map(response => response.data));
  }

  /**
   * Toggle workshop availability (is_available)
   */
  toggleAvailability(workshopId: number, isAvailable: boolean): Observable<Workshop> {
    return this.http
      .patch<WorkshopApiResponse<Workshop>>(
        `${this.apiUrl}/workshops/${workshopId}/availability`,
        { is_available: isAvailable }
      )
      .pipe(map(response => response.data));
  }

  /**
   * Verify or un-verify a workshop
   */
  verifyWorkshop(workshopId: number, isVerified: boolean): Observable<Workshop> {
    return this.http
      .patch<WorkshopApiResponse<Workshop>>(
        `${this.apiUrl}/workshops/${workshopId}/verify`,
        { is_verified: isVerified }
      )
      .pipe(map(response => response.data));
  }

  /**
   * Update workshop profile fields
   */
  updateWorkshop(workshopId: number, data: UpdateWorkshopRequest): Observable<Workshop> {
    return this.http
      .patch<WorkshopApiResponse<Workshop>>(
        `${this.apiUrl}/workshops/${workshopId}`,
        data
      )
      .pipe(map(response => response.data));
  }

  /**
   * Update workshop balance fields
   */
  updateWorkshopBalance(workshopId: number, data: UpdateWorkshopBalanceRequest): Observable<WorkshopBalance> {
    return this.http
      .patch<WorkshopApiResponse<WorkshopBalance>>(
        `${this.apiUrl}/workshops/${workshopId}/balance`,
        data
      )
      .pipe(map(response => response.data));
  }
}
