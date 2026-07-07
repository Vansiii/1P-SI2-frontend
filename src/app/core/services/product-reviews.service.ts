import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProductReview } from '../models/marketplace.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductReviewsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/marketplace/listings`;

  listReviews(listingId: number): Observable<ProductReview[]> {
    return this.http.get<{ data: ProductReview[] }>(`${this.baseUrl}/${listingId}/reviews`).pipe(
      map(res => res.data)
    );
  }

  createReview(listingId: number, data: { order_id: number; rating: number; title?: string; comment?: string }): Observable<ProductReview> {
    return this.http.post<{ data: ProductReview }>(`${this.baseUrl}/${listingId}/reviews`, { ...data, listing_id: listingId }).pipe(
      map(res => res.data)
    );
  }
}
