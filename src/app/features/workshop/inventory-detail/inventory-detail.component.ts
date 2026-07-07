import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryProduct, InventoryMovement } from '../../../core/models/inventory.model';
import { ConnectivityService } from '../../../core/services/connectivity.service';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inventory-detail.component.html',
  styles: [`
    .detail-container { padding: 1.5rem; max-width: 1000px; margin: 0 auto; }
    .detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-sm { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
    
    .card-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .card-title { font-size: 1.1rem; font-weight: 600; color: #111827; margin-bottom: 1rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.5rem; }
    
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .field-group { margin-bottom: 0.75rem; }
    .field-group label { display: block; font-size: 0.75rem; color: #6b7280; font-weight: 500; }
    .field-group div { font-size: 0.875rem; color: #1f2937; font-weight: 600; margin-top: 0.15rem; }
    .sku-code { font-family: monospace; font-size: 0.8125rem; background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 0.25rem; color: #374151; display: inline-block; }

    .tag-container { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.25rem; }
    .tag { background: #f3f4f6; border-radius: 0.25rem; padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #374151; }

    .stock-highlight { text-align: center; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; }
    .bg-green-soft { background: #f0fdf4; color: #15803d; border: 1px dashed #bbf7d0; }
    .bg-amber-soft { background: #fffbeb; color: #b45309; border: 1px dashed #fde68a; }
    .bg-red-soft { background: #fef2f2; color: #b91c1c; border: 1px dashed #fca5a5; }
    .stock-val { font-size: 2.25rem; font-weight: 800; }

    .history-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .history-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8125rem; }
    .history-table th { background: #f9fafb; padding: 0.65rem 0.85rem; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
    .history-table td { padding: 0.75rem 0.85rem; border-bottom: 1px solid #e5e7eb; color: #4b5563; }
    .history-table tr:last-child td { border-bottom: none; }
    
    .badge { font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 9999px; font-weight: 600; display: inline-block; }
    .badge-entrada { background: #d1fae5; color: #065f46; }
    .badge-salida { background: #fee2e2; color: #991b1b; }
    .badge-ajuste { background: #fef3c7; color: #92400e; }
    .badge-devolucion { background: #e0f2fe; color: #0369a1; }

    .pagination { display: flex; justify-content: flex-end; gap: 0.25rem; margin-top: 1rem; }
    .page-btn { padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 0.25rem; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
    .alert-error { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.25rem; font-size: 0.875rem; }
  `]
})
export class InventoryDetailComponent implements OnInit {
  private service = inject(InventoryService);
  private route = inject(ActivatedRoute);
  connectivity = inject(ConnectivityService);

  productId = signal<number>(0);
  product = signal<InventoryProduct | null>(null);
  movements = signal<InventoryMovement[]>([]);
  
  loading = signal(true);
  error = signal<string | null>(null);

  // Pagination states
  page = signal(1);
  size = signal(10);
  totalMovements = signal(0);
  totalPages = signal(0);
  hasPrev = signal(false);
  hasNext = signal(false);

  constructor() {
    effect(() => {
      this.loadMovements();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.productId.set(+id);
      this.loadProduct(+id);
    }
  }

  loadProduct(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getProduct(id).subscribe({
      next: (data) => {
        this.product.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al cargar ficha de producto');
        this.loading.set(false);
      }
    });
  }

  loadMovements(): void {
    const id = this.productId();
    if (!id) return;

    this.service.listMovements(id, this.page(), this.size()).subscribe({
      next: (response) => {
        this.movements.set(response.data);
        this.totalMovements.set(response.pagination.total);
        this.totalPages.set(response.pagination.total_pages);
        this.hasPrev.set(response.pagination.has_previous);
        this.hasNext.set(response.pagination.has_next);
      },
      error: () => {}
    });
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
}
