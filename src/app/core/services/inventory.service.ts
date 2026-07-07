import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  InventoryProduct, 
  InventoryMovement, 
  InventoryCategory, 
  StockAlert, 
  InventoryDashboardData 
} from '../models/inventory.model';
import { ApiResponse } from './service-catalog.service';

export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    size: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/workshop/inventory`;

  listProducts(filters: any = {}): Observable<PaginatedApiResponse<InventoryProduct>> {
    let params = new HttpParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined) {
        params = params.set(key, filters[key].toString());
      }
    });

    return this.http.get<PaginatedApiResponse<InventoryProduct>>(`${this.apiUrl}/products`, { params });
  }

  getProduct(id: number): Observable<InventoryProduct> {
    return this.http
      .get<ApiResponse<InventoryProduct>>(`${this.apiUrl}/products/${id}`)
      .pipe(map(r => r.data));
  }

  createProduct(data: any): Observable<InventoryProduct> {
    return this.http
      .post<ApiResponse<InventoryProduct>>(`${this.apiUrl}/products`, data)
      .pipe(map(r => r.data));
  }

  updateProduct(id: number, data: any): Observable<InventoryProduct> {
    return this.http
      .patch<ApiResponse<InventoryProduct>>(`${this.apiUrl}/products/${id}`, data)
      .pipe(map(r => r.data));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/products/${id}`)
      .pipe(map(() => undefined));
  }

  getLowStockProducts(): Observable<InventoryProduct[]> {
    return this.http
      .get<ApiResponse<InventoryProduct[]>>(`${this.apiUrl}/products/low-stock`)
      .pipe(map(r => r.data));
  }

  getOutOfStockProducts(): Observable<InventoryProduct[]> {
    return this.http
      .get<ApiResponse<InventoryProduct[]>>(`${this.apiUrl}/products/out-of-stock`)
      .pipe(map(r => r.data));
  }

  createMovement(data: any): Observable<InventoryMovement> {
    return this.http
      .post<ApiResponse<InventoryMovement>>(`${this.apiUrl}/movements`, data)
      .pipe(map(r => r.data));
  }

  listMovements(productId?: number, page: number = 1, size: number = 20): Observable<PaginatedApiResponse<InventoryMovement>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (productId) {
      params = params.set('product_id', productId.toString());
    }
    return this.http.get<PaginatedApiResponse<InventoryMovement>>(`${this.apiUrl}/movements`, { params });
  }

  listCategories(): Observable<InventoryCategory[]> {
    return this.http
      .get<ApiResponse<InventoryCategory[]>>(`${this.apiUrl}/categories`)
      .pipe(map(r => r.data));
  }

  createCategory(data: any): Observable<InventoryCategory> {
    return this.http
      .post<ApiResponse<InventoryCategory>>(`${this.apiUrl}/categories`, data)
      .pipe(map(r => r.data));
  }

  updateCategory(id: number, data: any): Observable<InventoryCategory> {
    return this.http
      .patch<ApiResponse<InventoryCategory>>(`${this.apiUrl}/categories/${id}`, data)
      .pipe(map(r => r.data));
  }

  deleteCategory(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/categories/${id}`)
      .pipe(map(() => undefined));
  }

  listAlerts(unreadOnly: boolean = true): Observable<StockAlert[]> {
    const params = new HttpParams().set('unread_only', unreadOnly.toString());
    return this.http
      .get<ApiResponse<StockAlert[]>>(`${this.apiUrl}/alerts`, { params })
      .pipe(map(r => r.data));
  }

  markAlertRead(id: number): Observable<any> {
    return this.http
      .patch<ApiResponse<any>>(`${this.apiUrl}/alerts/${id}/read`, {})
      .pipe(map(r => r.data));
  }

  markAllAlertsRead(): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.apiUrl}/alerts/mark-all-read`, {})
      .pipe(map(r => r.data));
  }

  getDashboard(): Observable<InventoryDashboardData> {
    return this.http
      .get<ApiResponse<InventoryDashboardData>>(`${this.apiUrl}/dashboard`)
      .pipe(map(r => r.data));
  }
}
