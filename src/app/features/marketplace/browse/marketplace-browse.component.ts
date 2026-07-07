import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { MarketplaceListing } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-marketplace-browse',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketplace-browse.component.html',
  styles: [`
    .browse-container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 260px 1fr; gap: 1.5rem; }
    .filters-sidebar { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); height: fit-content; }
    
    .catalog-main { display: flex; flex-direction: column; gap: 1.25rem; }
    .search-bar { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; gap: 0.5rem; }
    .search-input { flex: 1; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem; font-size: 0.8125rem; }
    .search-input:focus { outline: none; border-color: #f97316; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .product-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.15s, box-shadow 0.15s; display: flex; flex-direction: column; }
    .product-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -1px rgba(0,0,0,0.08); }
    .product-img { width: 100%; height: 160px; object-fit: cover; background: #f3f4f6; }
    .product-info { padding: 0.85rem; display: flex; flex-direction: column; flex: 1; }
    
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; text-align: center; display: inline-block; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    
    .badge { font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
    .badge-universal { background: #dbeafe; color: #1e40af; }
    .badge-compatible { background: #d1fae5; color: #065f46; }
    .badge-incompatible { background: #f3f4f6; color: #374151; }
    
    .filter-group { margin-bottom: 1.25rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 1rem; }
    .filter-group:last-child { border-bottom: none; padding-bottom: 0; }
    .filter-title { font-size: 0.75rem; font-weight: 700; color: #374151; text-transform: uppercase; margin-bottom: 0.5rem; }
    
    .loading-container { text-align: center; padding: 6rem; color: #9ca3af; grid-column: 1 / -1; }
  `]
})
export class MarketplaceBrowseComponent implements OnInit {
  private service = inject(MarketplaceService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);

  listings = signal<MarketplaceListing[]>([]);
  categories = signal<any[]>([]);
  vehicles = signal<any[]>([]);
  loading = signal(true);

  // Filters State
  search = signal<string>('');
  selectedCategory = signal<number | null>(null);
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  selectedVehicle = signal<any | null>(null);
  sortBy = signal<string>('newest');
  page = signal<number>(1);
  total = signal<number>(0);

  // Compare listings list
  compareIds = signal<number[]>([]);

  constructor() {
    // Reload items on filter changes
    effect(() => {
      this.loadListings();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadClientVehicles();
  }

  loadListings(): void {
    this.loading.set(true);
    const filters = {
      search: this.search(),
      category_id: this.selectedCategory(),
      min_price: this.minPrice(),
      max_price: this.maxPrice(),
      vehicle_brand: this.selectedVehicle()?.marca,
      vehicle_model: this.selectedVehicle()?.modelo,
      sort_by: this.sortBy(),
      page: this.page(),
      size: 16
    };

    this.service.listListings(filters).subscribe({
      next: (res) => {
        this.listings.set(res.data);
        this.total.set(res.pagination?.total_items ?? res.data.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadCategories(): void {
    // Categories endpoint from service catalog module
    this.http.get<{ data: any[] }>(`${environment.apiUrl}/workshop/services/categories`).pipe(
      map(res => res.data)
    ).subscribe({
      next: (data) => this.categories.set(data),
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

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.search.set(val);
    this.page.set(1);
  }

  filterCategory(id: number | null): void {
    this.selectedCategory.set(id);
    this.page.set(1);
  }

  filterVehicle(event: Event): void {
    const idx = (event.target as HTMLSelectElement).value;
    if (idx === '') {
      this.selectedVehicle.set(null);
    } else {
      this.selectedVehicle.set(this.vehicles()[parseInt(idx, 10)]);
    }
    this.page.set(1);
  }

  setSort(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.sortBy.set(val);
    this.page.set(1);
  }

  isCompatible(listing: MarketplaceListing): boolean {
    if (listing.universal) return true;
    const veh = this.selectedVehicle();
    if (!veh) return false;
    
    // Check if vehicle brand is in compatibility list
    const brands = listing.compatible_brands || [];
    return brands.includes(veh.marca);
  }

  toggleCompare(listingId: number): void {
    const current = this.compareIds();
    if (current.includes(listingId)) {
      this.compareIds.set(current.filter(id => id !== listingId));
    } else {
      if (current.length >= 3) {
        this.toast.error('Solo puede comparar un máximo de 3 productos a la vez.');
        return;
      }
      this.compareIds.set([...current, listingId]);
    }
  }

  isComparing(listingId: number): boolean {
    return this.compareIds().includes(listingId);
  }
}
