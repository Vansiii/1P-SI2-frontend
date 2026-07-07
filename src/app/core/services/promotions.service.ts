import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Promotion } from '../models/marketplace.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PromotionsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/workshop/promotions`;

  listPromotions(): Observable<Promotion[]> {
    return this.http.get<{ data: Promotion[] }>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  createPromotion(data: any): Observable<Promotion> {
    return this.http.post<{ data: Promotion }>(this.baseUrl, data).pipe(
      map(res => res.data)
    );
  }

  getPromotion(id: number): Observable<Promotion> {
    return this.http.get<{ data: Promotion }>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  updatePromotion(id: number, data: any): Observable<Promotion> {
    return this.http.patch<{ data: Promotion }>(`${this.baseUrl}/${id}`, data).pipe(
      map(res => res.data)
    );
  }

  deletePromotion(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
