import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Supplier, SupplierCreate, SupplierUpdate } from '../models/supplier.model';
import { ApiResponse } from './service-catalog.service';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/workshop/suppliers`;

  listSuppliers(): Observable<Supplier[]> {
    return this.http
      .get<ApiResponse<Supplier[]>>(this.apiUrl)
      .pipe(map(r => r.data));
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http
      .get<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`)
      .pipe(map(r => r.data));
  }

  createSupplier(data: SupplierCreate): Observable<Supplier> {
    return this.http
      .post<ApiResponse<Supplier>>(this.apiUrl, data)
      .pipe(map(r => r.data));
  }

  updateSupplier(id: number, data: SupplierUpdate): Observable<Supplier> {
    return this.http
      .patch<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`, data)
      .pipe(map(r => r.data));
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => undefined));
  }

  getSupplierProducts(id: number): Observable<any[]> {
    return this.http
      .get<ApiResponse<any[]>>(`${this.apiUrl}/${id}/products`)
      .pipe(map(r => r.data));
  }
}
