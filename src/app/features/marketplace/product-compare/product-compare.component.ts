import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { MarketplaceListing } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-compare',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-compare.component.html',
  styles: [`
    .compare-container { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    
    .compare-grid { display: grid; grid-template-columns: 200px repeat(3, 1fr); gap: 1rem; margin-top: 1.5rem; }
    .header-cell { background: #f9fafb; padding: 1rem; border-radius: 0.5rem; display: flex; flex-direction: column; justify-content: space-between; }
    .label-cell { font-weight: 700; color: #4b5563; font-size: 0.75rem; text-transform: uppercase; display: flex; align-items: center; padding: 0.75rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
    .value-cell { padding: 0.75rem 0.5rem; border-bottom: 1px solid #f3f4f6; font-size: 0.8125rem; color: #1f2937; }
    
    .btn { font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 600; text-align: center; }
    .btn:hover { background: #f9fafb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
  `]
})
export class ProductCompareComponent implements OnInit {
  private service = inject(MarketplaceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  compareListings = signal<MarketplaceListing[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    const idsParam = this.route.snapshot.queryParamMap.get('ids');
    if (!idsParam) {
      this.toast.error('No se especificaron productos para comparar.');
      this.router.navigate(['/marketplace/browse']);
      return;
    }

    const ids = idsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (ids.length === 0) {
      this.toast.error('Productos no válidos.');
      this.router.navigate(['/marketplace/browse']);
      return;
    }

    this.loadCompareData(ids);
  }

  loadCompareData(ids: number[]): void {
    this.loading.set(true);
    this.service.compareListings(ids).subscribe({
      next: (data) => {
        this.compareListings.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error al cargar la comparación de productos.');
        this.loading.set(false);
      }
    });
  }

  removeItem(listingId: number): void {
    const updated = this.compareListings().filter(item => item.id !== listingId);
    this.compareListings.set(updated);
    
    if (updated.length === 0) {
      this.router.navigate(['/marketplace/browse']);
    } else {
      // update query params
      const ids = updated.map(item => item.id).join(',');
      this.router.navigate([], { queryParams: { ids }, replaceUrl: true });
    }
  }
}
