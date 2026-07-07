import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { InventoryProduct, InventoryCategory, StockAlert } from '../../../core/models/inventory.model';
import { Supplier } from '../../../core/models/supplier.model';
import { ConnectivityService } from '../../../core/services/connectivity.service';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './inventory-list.component.html',
  styles: [`
    .inventory-container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .inventory-header { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem;
      padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 1rem;
    }
    .kpi-icon {
      width: 3rem; height: 3rem; border-radius: 0.5rem; display: flex; align-items: center;
      justify-content: center; font-size: 1.5rem;
    }
    .bg-kpi-blue { background: #eff6ff; color: #1d4ed8; }
    .bg-kpi-orange { background: #fff7ed; color: #ea580c; }
    .bg-kpi-red { background: #fef2f2; color: #dc2626; }
    .bg-kpi-green { background: #f0fdf4; color: #16a34a; }
    .kpi-val { font-size: 1.5rem; font-weight: 700; color: #111827; margin-top: 0.25rem; }
    .kpi-label { font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    
    .filters-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .filter-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .filter-group label { font-size: 0.75rem; font-weight: 600; color: #4b5563; }
    .filter-input {
      padding: 0.45rem 0.65rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.8125rem; outline: none; background: #fff; transition: all 0.15s;
    }
    .filter-input:focus { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }
    
    .inventory-table-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1.5rem; }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .inventory-table { width: 100%; min-width: 920px; border-collapse: collapse; text-align: left; font-size: 0.875rem; }
    .inventory-table th { background: #f9fafb; padding: 0.75rem 1rem; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; }
    .inventory-table td { padding: 0.85rem 1rem; border-bottom: 1px solid #e5e7eb; color: #4b5563; vertical-align: middle; }
    .inventory-table tr:last-child td { border-bottom: none; }
    .inventory-table tr:hover td { background: #fdfefe; }
    .inventory-table tr.low-stock-row td { background: #fffbeb; }
    .inventory-table tr.out-stock-row td { background: #fef2f2; }
    
    .badge { font-size: 0.725rem; padding: 0.15rem 0.45rem; border-radius: 9999px; font-weight: 600; display: inline-block; }
    .badge-status { background: #e5e7eb; color: #374151; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-info { background: #e0f2fe; color: #0369a1; }
    .sku-code { font-family: monospace; font-size: 0.75rem; background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.25rem; color: #374151; }

    .btn { font-size: 0.8125rem; padding: 0.4rem 0.9rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-sm { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; white-space: nowrap; }
    .btn-sm i { margin-right: 0.3rem; }
    .btn-publish { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .btn-publish:hover { background: #dbeafe; border-color: #93c5fd; }
    .btn-unpublish { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
    .btn-unpublish:hover { background: #a7f3d0; border-color: #6ee7b7; }
    .btn-unpublish:disabled { opacity: 0.7; cursor: not-allowed; }
    .actions-cell { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }

    .pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; }
    .pagination-pages { display: flex; gap: 0.25rem; }
    .page-btn { padding: 0.35rem 0.7rem; font-size: 0.8125rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
    .page-btn.active { background: #f97316; color: #fff; border-color: #f97316; }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog { background: #fff; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .dialog h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 1.25rem; color: #111827; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.8125rem; font-weight: 500; color: #374151; margin-bottom: 0.35rem; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.875rem; outline: none; box-sizing: border-box; transition: all 0.15s;
    }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
      border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15);
    }
    .dialog-footer { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; }
    .empty-state { text-align: center; padding: 4rem 1rem; color: #6b7280; background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; }
    .empty-state h3 { font-size: 1.15rem; color: #374151; margin-bottom: 0.5rem; }
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.25rem; font-size: 0.875rem; }
    .alert-error { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    .alert-warning { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
  `]
})
export class InventoryListComponent implements OnInit {
  private service = inject(InventoryService);
  private suppliersService = inject(SuppliersService);
  private marketplaceService = inject(MarketplaceService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  connectivity = inject(ConnectivityService);
  unpublishingId = signal<number | null>(null);

  // Lists
  products = signal<InventoryProduct[]>([]);
  categories = signal<InventoryCategory[]>([]);
  suppliers = signal<Supplier[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Pagination & Filter States
  totalProducts = signal(0);
  totalPages = signal(0);
  hasPrev = signal(false);
  hasNext = signal(false);

  filters = {
    search: signal(''),
    category_id: signal<number | null>(null),
    supplier_id: signal<number | null>(null),
    low_stock: signal<boolean | null>(null),
    out_of_stock: signal<boolean | null>(null),
    page: signal(1),
    size: signal(15)
  };

  // KPIs
  kpis = signal({
    total_products: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_value: 0.0
  });

  // Movement Form
  showMovementModal = signal(false);
  movementProduct = signal<InventoryProduct | null>(null);
  movementForm!: FormGroup;
  movementLoading = signal(false);
  movementError = signal<string | null>(null);

  constructor() {
    // Effect to reload products when filters or page changes
    effect(() => {
      this.loadProducts();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.initMovementForm();
    this.loadSuppliers();
    this.loadCategories();
    this.loadKPIs();
  }

  initMovementForm(): void {
    this.movementForm = this.fb.group({
      type: ['entrada', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unit_cost: [null],
      reference_type: ['ajuste_manual'],
      reference_id: [null],
      notes: ['']
    });

    // Handle conditional validation for unit_cost (required for entrada)
    this.movementForm.get('type')?.valueChanges.subscribe(val => {
      const costCtrl = this.movementForm.get('unit_cost');
      if (val === 'entrada') {
        costCtrl?.setValidators([Validators.required, Validators.min(0)]);
      } else {
        costCtrl?.clearValidators();
      }
      costCtrl?.updateValueAndValidity();
    });
  }

  loadProducts(): void {
    this.loading.set(true);
    const filterParams = {
      search: this.filters.search().trim() || undefined,
      category_id: this.filters.category_id() || undefined,
      supplier_id: this.filters.supplier_id() || undefined,
      low_stock: this.filters.low_stock() || undefined,
      out_of_stock: this.filters.out_of_stock() || undefined,
      page: this.filters.page(),
      size: this.filters.size()
    };

    this.service.listProducts(filterParams).subscribe({
      next: (response) => {
        this.products.set(response.data);
        this.totalProducts.set(response.pagination.total);
        this.totalPages.set(response.pagination.total_pages);
        this.hasPrev.set(response.pagination.has_previous);
        this.hasNext.set(response.pagination.has_next);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al cargar productos');
        this.loading.set(false);
      }
    });
  }

  loadSuppliers(): void {
    this.suppliersService.listSuppliers().subscribe({
      next: (data) => this.suppliers.set(data),
      error: () => {}
    });
  }

  loadCategories(): void {
    this.service.listCategories().subscribe({
      next: (data) => this.categories.set(data),
      error: () => {}
    });
  }

  loadKPIs(): void {
    this.service.getDashboard().subscribe({
      next: (data) => {
        this.kpis.set({
          total_products: data.total_products,
          low_stock_count: data.low_stock_count,
          out_of_stock_count: data.out_of_stock_count,
          total_value: data.total_value
        });
      },
      error: () => {}
    });
  }

  resetFilters(): void {
    this.filters.search.set('');
    this.filters.category_id.set(null);
    this.filters.supplier_id.set(null);
    this.filters.low_stock.set(null);
    this.filters.out_of_stock.set(null);
    this.filters.page.set(1);
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.filters.page.set(p);
  }

  openMovement(product: InventoryProduct): void {
    this.movementProduct.set(product);
    this.movementForm.reset({
      type: 'entrada',
      quantity: 1,
      unit_cost: product.cost_price,
      reference_type: 'ajuste_manual',
      notes: ''
    });
    this.movementError.set(null);
    this.showMovementModal.set(true);
  }

  onSubmitMovement(): void {
    if (this.movementForm.invalid || !this.movementProduct()) return;

    this.movementLoading.set(true);
    this.movementError.set(null);

    const formValue = this.movementForm.value;
    const requestData = {
      product_id: this.movementProduct()!.id,
      type: formValue.type,
      quantity: formValue.quantity,
      unit_cost: formValue.unit_cost,
      reference_type: formValue.reference_type,
      notes: formValue.notes
    };

    this.service.createMovement(requestData).subscribe({
      next: () => {
        this.showMovementModal.set(false);
        this.movementLoading.set(false);
        this.loadProducts();
        this.loadKPIs();
      },
      error: (err) => {
        this.movementError.set(err.error?.detail || 'Error al registrar el movimiento');
        this.movementLoading.set(false);
      }
    });
  }

  deleteProduct(id: number): void {
    if (!confirm('¿Estás seguro de eliminar este producto del inventario? Se realizará un borrado lógico.')) {
      return;
    }
    this.service.deleteProduct(id).subscribe({
      next: () => {
        this.loadProducts();
        this.loadKPIs();
      },
      error: (err) => {
        alert(err.error?.detail || 'Error al eliminar el producto');
      }
    });
  }

  unpublishProduct(product: InventoryProduct): void {
    if (!confirm(`¿Retirar "${product.name}" del marketplace? Los clientes ya no podrán verlo ni comprarlo.`)) {
      return;
    }
    this.unpublishingId.set(product.id);
    this.marketplaceService.deleteListingByProduct(product.id).subscribe({
      next: () => {
        this.unpublishingId.set(null);
        this.loadProducts();
      },
      error: (err) => {
        this.unpublishingId.set(null);
        alert(err.error?.detail || 'Error al retirar la publicación del marketplace');
      }
    });
  }
}
