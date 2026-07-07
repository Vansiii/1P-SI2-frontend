import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PromotionsService } from '../../../core/services/promotions.service';
import { Promotion } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-promotions-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './promotions-manager.component.html',
  styles: [`
    .promo-container { padding: 1.5rem; max-width: 1000px; margin: 0 auto; }
    .promo-header { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-danger { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
    .btn-danger:hover { background: #fecaca; }
    .btn-sm { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
    .btn-sm i { margin-right: 0.3rem; }
    .actions-cell { display: flex; gap: 0.35rem; justify-content: flex-end; border-top: 1px solid #f3f4f6; padding-top: 0.75rem; }

    .promo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .promo-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
    .promo-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #f97316; }
    
    .badge { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 9999px; font-weight: 600; display: inline-block; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-expired { background: #f3f4f6; color: #374151; }
    
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; border-radius: 0.75rem; width: 100%; max-width: 500px; padding: 1.5rem; }
    
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; font-size: 0.8125rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-sizing: border-box; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
  `]
})
export class PromotionsManagerComponent implements OnInit {
  private service = inject(PromotionsService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  promotions = signal<Promotion[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  submitLoading = signal(false);

  // Modal Dialog States
  showAddModal = signal(false);
  promoForm!: FormGroup;

  ngOnInit(): void {
    this.loadPromotions();
    this.promoForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      description: [''],
      type: ['percentage', Validators.required],
      value: [0, [Validators.required, Validators.min(0.01)]],
      applies_to: ['all', Validators.required],
      starts_at: ['', Validators.required],
      ends_at: ['', Validators.required],
      max_uses: [null],
      min_purchase: [0]
    });
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.listPromotions().subscribe({
      next: (data) => {
        this.promotions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(err.error?.detail || 'No se pudieron cargar sus campañas. Intente recargar la página.');
      }
    });
  }

  isPromoActive(promo: Promotion): boolean {
    const now = new Date();
    const start = new Date(promo.starts_at);
    const end = new Date(promo.ends_at);
    return promo.is_active && now >= start && now <= end;
  }

  openAddModal(): void {
    this.promoForm.reset({
      type: 'percentage',
      applies_to: 'all',
      value: 10,
      min_purchase: 0
    });
    this.showAddModal.set(true);
  }

  submitPromo(): void {
    if (this.promoForm.invalid) return;
    this.submitLoading.set(true);

    const formVal = this.promoForm.value;
    // Format dates to ISO String timezone offset safe
    const payload = {
      ...formVal,
      starts_at: new Date(formVal.starts_at).toISOString(),
      ends_at: new Date(formVal.ends_at).toISOString()
    };

    this.service.createPromotion(payload).subscribe({
      next: (newPromo) => {
        this.promotions.update(items => [newPromo, ...items]);
        this.toast.success('Campaña de descuento creada exitosamente.');
        this.submitLoading.set(false);
        this.showAddModal.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'Error al crear la promoción.');
        this.submitLoading.set(false);
      }
    });
  }

  togglePromotionStatus(promo: Promotion): void {
    const nextState = !promo.is_active;
    this.service.updatePromotion(promo.id, { is_active: nextState }).subscribe({
      next: (updated) => {
        this.promotions.update(items =>
          items.map(i => i.id === promo.id ? { ...i, is_active: updated.is_active } : i)
        );
        this.toast.success(nextState ? 'Campaña activada.' : 'Campaña pausada.');
      },
      error: () => {
        this.toast.error('Error al actualizar el estado de la campaña.');
      }
    });
  }

  deletePromotion(promo: Promotion): void {
    if (!confirm(`¿Está seguro de que desea eliminar la campaña "${promo.name}"?`)) return;

    this.service.deletePromotion(promo.id).subscribe({
      next: () => {
        this.promotions.update(items => items.filter(i => i.id !== promo.id));
        this.toast.success('Campaña eliminada.');
      },
      error: () => {
        this.toast.error('Error al eliminar la campaña.');
      }
    });
  }
}
