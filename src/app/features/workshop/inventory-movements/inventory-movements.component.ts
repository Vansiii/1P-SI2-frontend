import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryMovement } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-movements',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inventory-movements.component.html',
  styles: [`
    .movements-container { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    .movements-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    
    .history-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .history-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8125rem; }
    .history-table th { background: #f9fafb; padding: 0.75rem 0.85rem; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
    .history-table td { padding: 0.85rem 0.85rem; border-bottom: 1px solid #e5e7eb; color: #4b5563; }
    .history-table tr:last-child td { border-bottom: none; }
    
    .badge { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 9999px; font-weight: 600; display: inline-block; }
    .badge-entrada { background: #d1fae5; color: #065f46; }
    .badge-salida { background: #fee2e2; color: #991b1b; }
    .badge-ajuste { background: #fef3c7; color: #92400e; }
    .badge-devolucion { background: #e0f2fe; color: #0369a1; }
    
    .sku-code { font-family: monospace; font-size: 0.75rem; background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.25rem; color: #374151; }

    .pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; }
    .pagination-pages { display: flex; gap: 0.25rem; }
    .page-btn { padding: 0.35rem 0.7rem; font-size: 0.8125rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
    .page-btn.active { background: #f97316; color: #fff; border-color: #f97316; }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
  `]
})
export class InventoryMovementsComponent implements OnInit {
  private service = inject(InventoryService);

  movements = signal<InventoryMovement[]>([]);
  loading = signal(true);

  // Pagination states
  page = signal(1);
  size = signal(15);
  totalMovements = signal(0);
  totalPages = signal(0);
  hasPrev = signal(false);
  hasNext = signal(false);

  constructor() {
    effect(() => {
      this.loadMovements();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {}

  loadMovements(): void {
    this.loading.set(true);
    this.service.listMovements(undefined, this.page(), this.size()).subscribe({
      next: (response) => {
        this.movements.set(response.data);
        this.totalMovements.set(response.pagination.total);
        this.totalPages.set(response.pagination.total_pages);
        this.hasPrev.set(response.pagination.has_previous);
        this.hasNext.set(response.pagination.has_next);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
}
