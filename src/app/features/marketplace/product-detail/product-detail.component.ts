import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { CartService } from '../../../core/services/cart.service';
import { ProductReviewsService } from '../../../core/services/product-reviews.service';
import { MarketplaceListing, ProductReview } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-detail.component.html',
  styles: [`
    .detail-container { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
    
    .gallery-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; display: flex; align-items: center; justify-content: center; height: 350px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .main-img { max-width: 100%; max-height: 100%; object-fit: contain; }
    
    .details-box { display: flex; flex-direction: column; gap: 1rem; }
    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 600; display: inline-block; width: fit-content; text-transform: uppercase; }
    .badge-universal { background: #dbeafe; color: #1e40af; }
    .badge-compatible { background: #d1fae5; color: #065f46; }
    .badge-incompatible { background: #fee2e2; color: #b91c1c; }
    
    .btn { font-size: 0.875rem; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 600; text-align: center; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-primary:disabled { background: #ffedd5; color: #ffb07c; border-color: #ffedd5; cursor: not-allowed; }
    
    .review-card { border-bottom: 1px solid #f3f4f6; padding: 1rem 0; }
    .review-card:last-child { border-bottom: none; }
  `]
})
export class ProductDetailComponent implements OnInit {
  private service = inject(MarketplaceService);
  private cartService = inject(CartService);
  private reviewService = inject(ProductReviewsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private http = inject(HttpClient);

  listingId = signal<number | null>(null);
  listing = signal<MarketplaceListing | null>(null);
  reviews = signal<ProductReview[]>([]);
  vehicles = signal<any[]>([]);
  selectedVehicle = signal<any | null>(null);
  quantity = signal<number>(1);

  loading = signal(true);
  cartLoading = signal(false);

  // New review form states
  showReviewForm = signal(false);
  newRating = signal(5);
  newReviewTitle = signal('');
  newReviewComment = signal('');
  associatedOrderId = signal<number | null>(null);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.toast.error('Publicación no encontrada.');
      this.router.navigate(['/marketplace/browse']);
      return;
    }
    this.listingId.set(parseInt(idParam, 10));
    this.loadListingDetails();
    this.loadReviews();
    this.loadClientVehicles();
  }

  loadListingDetails(): void {
    this.loading.set(true);
    this.service.getListing(this.listingId()!).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la publicación de repuesto.');
        this.router.navigate(['/marketplace/browse']);
      }
    });
  }

  loadReviews(): void {
    this.reviewService.listReviews(this.listingId()!).subscribe({
      next: (data) => this.reviews.set(data),
      error: () => {}
    });
  }

  loadClientVehicles(): void {
    this.http.get<{ data: any[] }>(`${environment.apiUrl}/vehiculos`).pipe(
      map(res => res.data)
    ).subscribe({
      next: (data) => this.vehicles.set(data),
      error: () => {}
    });
  }

  filterVehicle(event: Event): void {
    const idx = (event.target as HTMLSelectElement).value;
    if (idx === '') {
      this.selectedVehicle.set(null);
    } else {
      this.selectedVehicle.set(this.vehicles()[parseInt(idx, 10)]);
    }
  }

  isCompatible(): boolean {
    const item = this.listing();
    if (!item) return false;
    if (item.universal) return true;
    const veh = this.selectedVehicle();
    if (!veh) return false;
    
    const brands = item.compatible_brands || [];
    return brands.includes(veh.marca);
  }

  incrementQty(): void {
    const stock = this.listing()?.current_stock ?? 0;
    if (this.quantity() < stock) {
      this.quantity.set(this.quantity() + 1);
    }
  }

  decrementQty(): void {
    if (this.quantity() > 1) {
      this.quantity.set(this.quantity() - 1);
    }
  }

  addToCart(): void {
    if (!this.listing()) return;
    this.cartLoading.set(true);
    this.cartService.addItem(this.listingId()!, this.quantity()).subscribe({
      next: () => {
        this.toast.success('Producto añadido al carrito.');
        this.cartLoading.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'Error al añadir al carrito.');
        this.cartLoading.set(false);
      }
    });
  }

  submitReview(): void {
    if (!this.associatedOrderId()) {
      this.toast.error('Debe ingresar el código numérico de la orden asociada para verificar su compra.');
      return;
    }

    const payload = {
      order_id: this.associatedOrderId()!,
      rating: this.newRating(),
      title: this.newReviewTitle(),
      comment: this.newReviewComment()
    };

    this.reviewService.createReview(this.listingId()!, payload).subscribe({
      next: (newRev) => {
        this.reviews.update(items => [newRev, ...items]);
        this.toast.success('Reseña agregada exitosamente.');
        this.showReviewForm.set(false);
        // Reload listing details to refresh average rating
        this.loadListingDetails();
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'No se pudo publicar la reseña. Verifique el ID de la orden.');
      }
    });
  }
}
