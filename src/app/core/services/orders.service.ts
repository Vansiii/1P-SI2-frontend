import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MarketplaceOrder } from '../models/marketplace.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/orders`;

  checkoutCart(checkoutDetails: { delivery_type: string; delivery_address?: string; delivery_notes?: string }): Observable<MarketplaceOrder[]> {
    return this.http.post<{ data: MarketplaceOrder[] }>(this.baseUrl, checkoutDetails).pipe(
      map(res => res.data)
    );
  }

  listClientOrders(): Observable<MarketplaceOrder[]> {
    return this.http.get<{ data: MarketplaceOrder[] }>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  getClientOrder(id: number): Observable<MarketplaceOrder> {
    return this.http.get<{ data: MarketplaceOrder }>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  payOrder(orderId: number): Observable<{ client_secret: string; order_number: string; total: number }> {
    return this.http.post<{ data: { client_secret: string; order_number: string; total: number } }>(`${this.baseUrl}/${orderId}/pay`, {}).pipe(
      map(res => res.data)
    );
  }

  // ================= WORKSHOP ENDPOINTS =================

  listWorkshopOrders(): Observable<MarketplaceOrder[]> {
    return this.http.get<{ data: MarketplaceOrder[] }>(`${this.baseUrl}/workshop/list`).pipe(
      map(res => res.data)
    );
  }

  getWorkshopOrder(id: number): Observable<MarketplaceOrder> {
    return this.http.get<{ data: MarketplaceOrder }>(`${this.baseUrl}/workshop/${id}`).pipe(
      map(res => res.data)
    );
  }

  confirmOrder(id: number): Observable<MarketplaceOrder> {
    return this.http.patch<{ data: MarketplaceOrder }>(`${this.baseUrl}/workshop/${id}/confirm`, {}).pipe(
      map(res => res.data)
    );
  }

  prepareOrder(id: number): Observable<MarketplaceOrder> {
    return this.http.patch<{ data: MarketplaceOrder }>(`${this.baseUrl}/workshop/${id}/prepare`, {}).pipe(
      map(res => res.data)
    );
  }

  readyOrder(id: number): Observable<MarketplaceOrder> {
    return this.http.patch<{ data: MarketplaceOrder }>(`${this.baseUrl}/workshop/${id}/ready`, {}).pipe(
      map(res => res.data)
    );
  }

  cancelOrder(id: number, reason: string): Observable<MarketplaceOrder> {
    return this.http.patch<{ data: MarketplaceOrder }>(`${this.baseUrl}/workshop/${id}/cancel`, { reason }).pipe(
      map(res => res.data)
    );
  }
}
