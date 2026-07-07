import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ShoppingCart } from '../models/marketplace.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/cart`;

  // Reactive state containing the client's shopping cart
  cart = signal<ShoppingCart | null>(null);

  getCart(): Observable<ShoppingCart> {
    return this.http.get<{ data: ShoppingCart }>(this.baseUrl).pipe(
      map(res => res.data),
      tap(data => this.cart.set(data))
    );
  }

  addItem(listingId: number, quantity: number): Observable<ShoppingCart> {
    return this.http.post<{ data: ShoppingCart }>(`${this.baseUrl}/items`, { listing_id: listingId, quantity }).pipe(
      map(res => res.data),
      tap(data => this.cart.set(data))
    );
  }

  updateItem(itemId: number, quantity: number): Observable<ShoppingCart> {
    return this.http.patch<{ data: ShoppingCart }>(`${this.baseUrl}/items/${itemId}`, { quantity }).pipe(
      map(res => res.data),
      tap(data => this.cart.set(data))
    );
  }

  removeItem(itemId: number): Observable<ShoppingCart> {
    return this.http.delete<{ data: ShoppingCart }>(`${this.baseUrl}/items/${itemId}`).pipe(
      map(res => res.data),
      tap(data => this.cart.set(data))
    );
  }

  clearCart(): Observable<any> {
    return this.http.delete(this.baseUrl).pipe(
      tap(() => this.cart.set(null))
    );
  }

  validateCart(): Observable<{ is_valid: boolean; warnings: any[] }> {
    return this.http.get<{ data: { is_valid: boolean; warnings: any[] } }>(`${this.baseUrl}/validate`).pipe(
      map(res => res.data)
    );
  }
}
