import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

interface Workshop {
  id: number;
  email: string;
  workshop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  coverage_radius_km: number;
  is_active: boolean;
  created_at: string;
}

interface Technician {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_available: boolean;
  is_active: boolean;
}

interface AuditLog {
  id: number;
  user_id: number;
  user_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  /**
   * Get all workshops with pagination support
   */
  getWorkshops(params?: {
    active_only?: boolean;
    skip?: number;
    limit?: number;
  }): Observable<{ users: Workshop[]; total: number; page: number; page_size: number; total_pages: number }> {
    const queryParams = new URLSearchParams();
    queryParams.append('user_type', 'workshop');
    
    if (params) {
      if (params.active_only !== undefined) {
        queryParams.append('active_only', String(params.active_only));
      }
      if (params.skip !== undefined) {
        queryParams.append('skip', String(params.skip));
      }
      if (params.limit !== undefined) {
        queryParams.append('limit', String(params.limit));
      }
    }

    const url = `${this.apiBaseUrl}/users?${queryParams.toString()}`;

    return this.httpClient
      .get<ApiResponse<{ users: Workshop[]; total: number; page: number; page_size: number; total_pages: number }>>(url)
      .pipe(map((response) => response.data));
  }

  /**
   * Get technicians for a specific workshop
   */
  getWorkshopTechnicians(workshopId: number): Observable<Technician[]> {
    return this.httpClient
      .get<ApiResponse<{ users: Technician[] }>>(
        `${this.apiBaseUrl}/users?user_type=technician&workshop_id=${workshopId}`
      )
      .pipe(map((response) => response.data.users));
  }

  /**
   * Toggle workshop active status
   */
  toggleWorkshopStatus(workshopId: number, isActive: boolean): Observable<void> {
    return this.httpClient
      .patch<ApiResponse<any>>(`${this.apiBaseUrl}/users/${workshopId}`, {
        is_active: isActive,
      })
      .pipe(map(() => void 0));
  }

  /**
   * Get audit logs with optional filters and pagination
   */
  getAuditLogs(params?: {
    user_id?: number;
    user_type?: string;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }): Observable<{ logs: AuditLog[]; total: number; page: number; page_size: number; total_pages: number }> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${this.apiBaseUrl}/audit/logs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return this.httpClient
      .get<ApiResponse<{ logs: AuditLog[]; total: number; page: number; page_size: number; total_pages: number }>>(url)
      .pipe(map((response) => response.data));
  }

  /**
   * Get all users (for admin management)
   */
  getAllUsers(params?: {
    user_type?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Observable<{ users: any[]; total: number }> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${this.apiBaseUrl}/users${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return this.httpClient
      .get<ApiResponse<{ users: any[]; total: number }>>(url)
      .pipe(map((response) => response.data));
  }

  /**
   * Update user status (activate/deactivate)
   */
  updateUserStatus(userId: number, isActive: boolean): Observable<void> {
    return this.httpClient
      .patch<ApiResponse<any>>(`${this.apiBaseUrl}/users/${userId}`, {
        is_active: isActive,
      })
      .pipe(map(() => void 0));
  }
}
