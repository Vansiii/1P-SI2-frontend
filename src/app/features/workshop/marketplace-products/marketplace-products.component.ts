import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { MarketplaceListing } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-marketplace-products',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './marketplace-products.component.html',
  styles: [`
    .mkt-container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .mkt-header { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-danger { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
    .btn-danger:hover { background: #fecaca; }
    .btn-sm { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; white-space: nowrap; }
    .btn-sm i { margin-right: 0.3rem; }
    .actions-cell { display: flex; flex-wrap: wrap; gap: 0.35rem; justify-content: flex-end; }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stats-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1rem; display: flex; align-items: center; gap: 0.75rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .stats-icon { width: 2.25rem; height: 2.25rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
    .bg-orange-soft { background: #fff7ed; color: #f97316; }
    .bg-blue-soft { background: #f0f9ff; color: #0284c7; }
    .bg-green-soft { background: #f0fdf4; color: #16a34a; }
    .bg-purple-soft { background: #faf5ff; color: #7c3aed; }
    .stats-info .label { font-size: 0.75rem; color: #6b7280; font-weight: 500; }
    .stats-info .value { font-size: 1.25rem; font-weight: 700; color: #111827; }

    .listings-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .listings-table { width: 100%; min-width: 780px; border-collapse: collapse; text-align: left; font-size: 0.8125rem; }
    .listings-table th { background: #f9fafb; padding: 0.75rem 0.85rem; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
    .listings-table td { padding: 0.85rem 0.85rem; border-bottom: 1px solid #e5e7eb; color: #4b5563; vertical-align: middle; }
    .listings-table tr:hover td { background: #f9fafb; }
    
    .badge { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 9999px; font-weight: 600; display: inline-block; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-paused { background: #fee2e2; color: #991b1b; }
    .badge-draft { background: #f3f4f6; color: #374151; }

    .toggle-switch { position: relative; display: inline-block; width: 2.25rem; height: 1.25rem; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .2s; border-radius: 34px; }
    .toggle-slider:before { position: absolute; content: ""; height: 0.95rem; width: 0.95rem; left: 2px; bottom: 2px; background-color: white; transition: .2s; border-radius: 50%; }
    input:checked + .toggle-slider { background-color: #f97316; }
    input:checked + .toggle-slider:before { transform: translateX(16px); }

    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; border-radius: 0.75rem; width: 100%; max-width: 450px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea { width: 100%; font-size: 0.8125rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-sizing: border-box; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
  `]
})
export class MarketplaceProductsComponent implements OnInit {
  private service = inject(MarketplaceService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  listings = signal<MarketplaceListing[]>([]);
  stats = signal({
    total_listings: 0,
    total_views: 0,
    total_sales: 0,
    featured_listings: 0
  });

  loading = signal(true);
  loadError = signal<string | null>(null);

  // Edit Listing Dialog States
  selectedListing = signal<MarketplaceListing | null>(null);
  showEditModal = signal(false);
  editForm!: FormGroup;
  submitLoading = signal(false);

  ngOnInit(): void {
    this.loadData();
    this.editForm = this.fb.group({
      public_price: [0, [Validators.required, Validators.min(0.01)]],
      compare_at_price: [null],
      title: ['', [Validators.required, Validators.maxLength(300)]],
      description: ['']
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.listMyListings().subscribe({
      next: (data) => {
        this.listings.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(err.error?.detail || 'No se pudieron cargar sus publicaciones. Intente recargar la página.');
      }
    });

    this.service.getMyStats().subscribe({
      next: (data) => this.stats.set(data),
      error: () => {}
    });
  }

  toggleVisibility(listing: MarketplaceListing, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.service.updateListing(listing.id, { is_visible: checked }).subscribe({
      next: (updated) => {
        this.listings.update(items =>
          items.map(item => item.id === listing.id ? { ...item, is_visible: updated.is_visible, status: updated.status } : item)
        );
        this.toast.success(
          checked 
            ? `Publicación "${listing.title || listing.product_name}" visible en el marketplace.` 
            : `Publicación "${listing.title || listing.product_name}" pausada y oculta.`
        );
      },
      error: () => {
        this.toast.error('Error al actualizar visibilidad de la publicación.');
        // revert checkbox visually
        (event.target as HTMLInputElement).checked = !checked;
      }
    });
  }

  openEditModal(listing: MarketplaceListing): void {
    this.selectedListing.set(listing);
    this.editForm.patchValue({
      public_price: listing.public_price,
      compare_at_price: listing.compare_at_price,
      title: listing.title || listing.product_name,
      description: listing.description || ''
    });
    this.showEditModal.set(true);
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.selectedListing()) return;
    this.submitLoading.set(true);

    const payload = this.editForm.value;
    this.service.updateListing(this.selectedListing()!.id, payload).subscribe({
      next: (updated) => {
        this.listings.update(items =>
          items.map(item => item.id === updated.id ? updated : item)
        );
        this.toast.success('Publicación actualizada exitosamente.');
        this.submitLoading.set(false);
        this.showEditModal.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'Error al actualizar publicación.');
        this.submitLoading.set(false);
      }
    });
  }

  deleteListing(listing: MarketplaceListing): void {
    if (!confirm(`¿Está seguro de que desea retirar "${listing.title || listing.product_name}" del marketplace? Esto la devolverá al inventario interno.`)) return;

    this.service.deleteListing(listing.id).subscribe({
      next: () => {
        this.listings.update(items => items.filter(item => item.id !== listing.id));
        this.stats.update(s => ({ ...s, total_listings: s.total_listings - 1 }));
        this.toast.success('Publicación retirada del marketplace.');
      },
      error: () => {
        this.toast.error('Error al retirar la publicación.');
      }
    });
  }
}
