import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CatalogItem {
  id: number;
  servicio_id: number;
  servicio_nombre: string;
  categoria_id: number;
  categoria_nombre: string;
  modalidad: 'taller' | 'domicilio' | 'ambas';
  tiempo_estimado_min: number | null;
  precio: number | null;
  descripcion: string | null;
  is_active: boolean;
}

export interface Category {
  id: number;
  nombre: string;
  descripcion: string | null;
  icon: string | null;
}

export interface BaseService {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria_id: number;
  categoria_nombre: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceCatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}`;

  getCatalog(): Observable<CatalogItem[]> {
    return this.http
      .get<ApiResponse<CatalogItem[]>>(`${this.apiUrl}/workshop/catalog`)
      .pipe(map(r => r.data));
  }

  getCategories(): Observable<Category[]> {
    return this.http
      .get<ApiResponse<Category[]>>(`${this.apiUrl}/catalog/categories`)
      .pipe(map(r => r.data));
  }

  getBaseServices(): Observable<BaseService[]> {
    return this.http
      .get<ApiResponse<BaseService[]>>(`${this.apiUrl}/catalog/services`)
      .pipe(map(r => r.data));
  }

  createItem(data: {
    servicio_id: number;
    modalidad?: string;
    tiempo_estimado_min?: number | null;
    precio?: number | null;
    descripcion?: string | null;
  }): Observable<CatalogItem> {
    return this.http
      .post<ApiResponse<CatalogItem>>(`${this.apiUrl}/workshop/catalog/items`, data)
      .pipe(map(r => r.data));
  }

  updateItem(id: number, data: {
    modalidad?: string;
    tiempo_estimado_min?: number | null;
    precio?: number | null;
    descripcion?: string | null;
  }): Observable<CatalogItem> {
    return this.http
      .patch<ApiResponse<CatalogItem>>(`${this.apiUrl}/workshop/catalog/items/${id}`, data)
      .pipe(map(r => r.data));
  }

  toggleItem(id: number): Observable<CatalogItem> {
    return this.http
      .patch<ApiResponse<CatalogItem>>(`${this.apiUrl}/workshop/catalog/items/${id}/toggle`, {})
      .pipe(map(r => r.data));
  }

  deleteItem(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.apiUrl}/workshop/catalog/items/${id}`)
      .pipe(map(() => void 0));
  }
}
