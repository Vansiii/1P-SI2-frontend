import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MarketplaceListing } from '../models/marketplace.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/marketplace`;

  listListings(filters: any): Observable<{ data: MarketplaceListing[]; pagination: any }> {
    let params = new HttpParams();
    if (filters.search) params = params.set('search', filters.search);
    if (filters.category_id) params = params.set('category_id', filters.category_id.toString());
    if (filters.min_price) params = params.set('min_price', filters.min_price.toString());
    if (filters.max_price) params = params.set('max_price', filters.max_price.toString());
    if (filters.vehicle_brand) params = params.set('vehicle_brand', filters.vehicle_brand);
    if (filters.vehicle_model) params = params.set('vehicle_model', filters.vehicle_model);
    if (filters.sort_by) params = params.set('sort_by', filters.sort_by);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.size) params = params.set('size', filters.size.toString());

    return this.http.get<{ data: MarketplaceListing[]; pagination: any }>(`${this.baseUrl}/listings`, { params });
  }

  getListing(id: number): Observable<MarketplaceListing> {
    return this.http.get<{ data: MarketplaceListing }>(`${this.baseUrl}/listings/${id}`).pipe(
      map(res => res.data)
    );
  }

  compareListings(listingIds: number[]): Observable<MarketplaceListing[]> {
    return this.http.post<{ data: MarketplaceListing[] }>(`${this.baseUrl}/listings/compare`, { listing_ids: listingIds }).pipe(
      map(res => res.data)
    );
  }

  listMyListings(): Observable<MarketplaceListing[]> {
    return this.http.get<{ data: MarketplaceListing[] }>(`${this.baseUrl}/my-listings`).pipe(
      map(res => res.data)
    );
  }

  createListing(data: any): Observable<MarketplaceListing> {
    return this.http.post<{ data: MarketplaceListing }>(`${this.baseUrl}/listings`, data).pipe(
      map(res => res.data)
    );
  }

  updateListing(id: number, data: any): Observable<MarketplaceListing> {
    return this.http.patch<{ data: MarketplaceListing }>(`${this.baseUrl}/listings/${id}`, data).pipe(
      map(res => res.data)
    );
  }

  deleteListing(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/listings/${id}`);
  }

  /** Despublica el repuesto del marketplace conociendo sólo el ID del producto de inventario. */
  deleteListingByProduct(productId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/listings/by-product/${productId}`);
  }

  getMyStats(): Observable<any> {
    return this.http.get<{ data: any }>(`${this.baseUrl}/my-listings/stats`).pipe(
      map(res => res.data)
    );
  }
}
