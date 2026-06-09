import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ServiceCatalogService, CatalogItem, Category, BaseService } from '../../../core/services/service-catalog.service';
import { ConnectivityService } from '../../../core/services/connectivity.service';

@Component({
  selector: 'app-service-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './service-catalog.component.html',
  styles: [`
    .catalog-container { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    .catalog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
    .catalog-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem;
      padding: 1.25rem; transition: box-shadow 0.2s;
    }
    .catalog-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .catalog-card.inactive { opacity: 0.55; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .card-title { font-size: 1.05rem; font-weight: 600; color: #111827; }
    .card-badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; }
    .badge-active { background: #ecfdf5; color: #065f46; }
    .badge-inactive { background: #f3f4f6; color: #6b7280; }
    .badge-category { background: #eff6ff; color: #1e40af; }
    .badge-modalidad { background: #fef3c7; color: #92400e; }
    .card-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
    .card-desc { font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem; }
    .card-footer { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .btn { font-size: 0.8125rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; }
    .btn:hover { background: #f9fafb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; }
    .btn-danger { color: #dc2626; border-color: #fca5a5; }
    .btn-danger:hover { background: #fef2f2; }
    .btn-toggle { background: #f3f4f6; border: none; border-radius: 9999px; padding: 0.3rem 0.6rem; font-size: 0.75rem; }
    .empty-state { text-align: center; padding: 3rem 1rem; color: #6b7280; }
    .empty-state h3 { font-size: 1.25rem; color: #374151; margin-bottom: 0.5rem; }
    .loading { text-align: center; padding: 3rem; color: #9ca3af; }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; }
    .alert-warning { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
    .alert-error { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    .stats-bar { display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 0.875rem; color: #6b7280; }
    .stats-bar span { font-weight: 600; color: #111827; }
    .search-input {
      padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.875rem; width: 240px; outline: none;
    }
    .search-input:focus { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }
    /* Dialog overlay */
    .dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog { background: #fff; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
    .dialog h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.8125rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
    .form-group select, .form-group input, .form-group textarea {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.875rem; outline: none; box-sizing: border-box;
    }
    .form-group select:focus, .form-group input:focus, .form-group textarea:focus {
      border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15);
    }
    .dialog-footer { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class ServiceCatalogComponent implements OnInit {
  private service = inject(ServiceCatalogService);
  private connectivity = inject(ConnectivityService);

  items = signal<CatalogItem[]>([]);
  categories = signal<Category[]>([]);
  baseServices = signal<BaseService[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');

  showForm = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  editingItem = signal<CatalogItem | null>(null);
  formLoading = signal(false);
  formError = signal<string | null>(null);

  form = {
    servicio_id: signal<number>(0),
    modalidad: signal<'taller' | 'domicilio' | 'ambas'>('taller'),
    tiempo_estimado_min: signal<number | null>(null),
    precio: signal<number | null>(null),
    descripcion: signal<string>(''),
  };

  stats = computed(() => {
    const all = this.items();
    return {
      total: all.length,
      active: all.filter(i => i.is_active).length,
      inactive: all.filter(i => !i.is_active).length,
    };
  });

  filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(i =>
      i.servicio_nombre.toLowerCase().includes(q) ||
      i.categoria_nombre.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getCatalog().subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (err) => { this.error.set(err.error?.detail || 'Error al cargar el catálogo'); this.loading.set(false); }
    });
    this.service.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {}
    });
    this.service.getBaseServices().subscribe({
      next: (svcs) => this.baseServices.set(svcs),
      error: () => {}
    });
  }

  openCreate(): void {
    this.formMode.set('create');
    this.editingItem.set(null);
    this.form.servicio_id.set(0);
    this.form.modalidad.set('taller');
    this.form.tiempo_estimado_min.set(null);
    this.form.precio.set(null);
    this.form.descripcion.set('');
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(item: CatalogItem): void {
    this.formMode.set('edit');
    this.editingItem.set(item);
    this.form.servicio_id.set(item.servicio_id);
    this.form.modalidad.set(item.modalidad);
    this.form.tiempo_estimado_min.set(item.tiempo_estimado_min);
    this.form.precio.set(item.precio);
    this.form.descripcion.set(item.descripcion || '');
    this.formError.set(null);
    this.showForm.set(true);
  }

  submitForm(): void {
    // Validación básica
    if (this.formMode() === 'create' && this.form.servicio_id() === 0) {
      this.formError.set('Debe seleccionar un servicio');
      return;
    }
    if (!this.form.precio() || this.form.precio()! <= 0) {
      this.formError.set('El precio debe ser mayor a 0');
      return;
    }

    this.formLoading.set(true);
    this.formError.set(null);

    const data = {
      servicio_id: this.form.servicio_id(),
      modalidad: this.form.modalidad(),
      tiempo_estimado_min: this.form.tiempo_estimado_min() || undefined,
      precio: this.form.precio() ?? undefined,
      descripcion: this.form.descripcion() || undefined,
    };

    if (this.formMode() === 'create') {
      this.service.createItem(data).subscribe({
        next: () => { this.loadAll(); this.closeForm(); this.formLoading.set(false); },
        error: (err) => {
          if (err.status === 0) {
            this.closeForm();
            this.loadAll();
            this.formLoading.set(false);
            return;
          }
          this.formError.set(err.error?.detail || 'Error al crear servicio'); this.formLoading.set(false);
        }
      });
    } else {
      const item = this.editingItem()!;
      const updateData: any = {
        modalidad: data.modalidad,
        tiempo_estimado_min: data.tiempo_estimado_min,
        precio: data.precio,
        descripcion: data.descripcion,
      };
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
      this.service.updateItem(item.id, updateData).subscribe({
        next: () => { this.loadAll(); this.closeForm(); this.formLoading.set(false); },
        error: (err) => {
          if (err.status === 0) {
            this.items.update(all => all.map(i => i.id === item.id ? { ...i, ...updateData } : i));
            this.closeForm();
            this.formLoading.set(false);
            return;
          }
          this.formError.set(err.error?.detail || 'Error al actualizar servicio'); this.formLoading.set(false);
        }
      });
    }
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingItem.set(null);
  }

  toggleActive(item: CatalogItem): void {
    this.items.update(all => all.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    this.service.toggleItem(item.id).subscribe({
      next: () => this.loadAll(),
      error: (err) => {
        if (err.status === 0) return;
        this.items.update(all => all.map(i => i.id === item.id ? { ...i, is_active: item.is_active } : i));
        alert(err.error?.detail || 'Error al cambiar estado');
      }
    });
  }

  deleteItem(item: CatalogItem): void {
    if (!confirm(`¿Eliminar "${item.servicio_nombre}" del catalogo?`)) return;
    const prev = [...this.items()];
    this.items.update(all => all.filter(i => i.id !== item.id));
    this.service.deleteItem(item.id).subscribe({
      next: () => this.loadAll(),
      error: (err) => {
        if (err.status === 0) return;
        this.items.set(prev);
        alert(err.error?.detail || 'Error al eliminar servicio');
      }
    });
  }

  servicesByCategory(categoryId: number): BaseService[] {
    return this.baseServices().filter(s => s.categoria_id === categoryId);
  }
}
