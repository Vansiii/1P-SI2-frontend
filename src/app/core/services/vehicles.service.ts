import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Vehicle {
  id: number;
  client_id: number;
  matricula: string;
  marca?: string;
  modelo: string;
  anio: number;
  color?: string;
  imagen?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVehicleRequest {
  matricula: string;
  marca?: string;
  modelo: string;
  anio: number;
  color?: string;
  imagen?: string;
}

export interface UpdateVehicleRequest {
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  imagen?: string;
  is_active?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class VehiclesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vehiculos`;

  getVehicles(activeOnly: boolean = true): Observable<Vehicle[]> {
    return this.http
      .get<ApiResponse<Vehicle[]>>(this.apiUrl, {
        params: { active_only: activeOnly },
      })
      .pipe(map((response) => response.data));
  }

  getVehicle(vehicleId: number): Observable<Vehicle> {
    return this.http
      .get<ApiResponse<Vehicle>>(`${this.apiUrl}/${vehicleId}`)
      .pipe(map((response) => response.data));
  }

  createVehicle(request: CreateVehicleRequest): Observable<Vehicle> {
    return this.http
      .post<ApiResponse<Vehicle>>(this.apiUrl, request)
      .pipe(map((response) => response.data));
  }

  updateVehicle(
    vehicleId: number,
    request: UpdateVehicleRequest
  ): Observable<Vehicle> {
    return this.http
      .patch<ApiResponse<Vehicle>>(`${this.apiUrl}/${vehicleId}`, request)
      .pipe(map((response) => response.data));
  }

  deleteVehicle(vehicleId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${vehicleId}`)
      .pipe(map(() => undefined));
  }
}
