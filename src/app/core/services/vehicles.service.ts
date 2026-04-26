import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { WebSocketService } from './websocket.service';

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

@Injectable({
  providedIn: 'root',
})
export class VehiclesService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/vehiculos`;

  // Reactive state for vehicles list
  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  public vehicles$ = this.vehiclesSubject.asObservable();

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Subscribe to vehicle WebSocket events for real-time updates.
   * Validates: Requirements 6
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'vehicle_created':
          this.handleVehicleCreated(message.data);
          break;
        case 'vehicle_updated':
          this.handleVehicleUpdated(message.data);
          break;
        case 'vehicle_deleted':
          this.handleVehicleDeleted(message.data);
          break;
        case 'vehicle_image_uploaded':
          this.handleVehicleImageUploaded(message.data);
          break;
      }
    });
  }

  /**
   * Prepend newly created vehicle to the list.
   */
  private handleVehicleCreated(data: any): void {
    const newVehicle: Vehicle = {
      id: data.vehicle_id,
      client_id: data.client_id,
      marca: data.marca,
      modelo: data.modelo,
      anio: data.anio,
      matricula: data.matricula,
      is_active: true,
      created_at: data.timestamp || new Date().toISOString(),
      updated_at: data.timestamp || new Date().toISOString(),
    };
    this.vehiclesSubject.next([newVehicle, ...this.vehiclesSubject.value]);
    console.log(`✅ Vehicle ${data.vehicle_id} created and added to list`);
  }

  /**
   * Replace the matching vehicle in the list with updated data.
   */
  private handleVehicleUpdated(data: any): void {
    const vehicles = this.vehiclesSubject.value;
    const index = vehicles.findIndex(v => v.id === data.vehicle_id);

    if (index !== -1) {
      const updated: Vehicle = {
        ...vehicles[index],
        marca: data.marca ?? vehicles[index].marca,
        modelo: data.modelo ?? vehicles[index].modelo,
        anio: data.anio ?? vehicles[index].anio,
        matricula: data.matricula ?? vehicles[index].matricula,
        updated_at: data.timestamp || new Date().toISOString(),
      };
      const next = [...vehicles];
      next[index] = updated;
      this.vehiclesSubject.next(next);
      console.log(`✅ Vehicle ${data.vehicle_id} updated in list`);
    }
  }

  /**
   * Remove the deleted vehicle from the list.
   */
  private handleVehicleDeleted(data: any): void {
    const filtered = this.vehiclesSubject.value.filter(v => v.id !== data.vehicle_id);
    this.vehiclesSubject.next(filtered);
    console.log(`✅ Vehicle ${data.vehicle_id} removed from list`);
  }

  /**
   * Update the image URL on the matching vehicle.
   */
  private handleVehicleImageUploaded(data: any): void {
    const vehicles = this.vehiclesSubject.value;
    const index = vehicles.findIndex(v => v.id === data.vehicle_id);

    if (index !== -1) {
      const next = [...vehicles];
      next[index] = {
        ...next[index],
        imagen: data.image_url,
        updated_at: data.timestamp || new Date().toISOString(),
      };
      this.vehiclesSubject.next(next);
      console.log(`✅ Vehicle ${data.vehicle_id} image updated`);
    }
  }

  // ── HTTP methods ──────────────────────────────────────────────────────────

  getVehicles(activeOnly: boolean = true): Observable<Vehicle[]> {
    return this.http
      .get<ApiResponse<Vehicle[]>>(this.apiUrl, {
        params: { active_only: activeOnly },
      })
      .pipe(
        map((response) => {
          this.vehiclesSubject.next(response.data);
          return response.data;
        })
      );
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
