import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { Supplier } from '../../../core/models/supplier.model';
import { ConnectivityService } from '../../../core/services/connectivity.service';

@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './suppliers-list.component.html',
  styles: [`
    .suppliers-container { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    .suppliers-header { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .search-bar { display: flex; gap: 1rem; align-items: center; flex: 1; min-width: 200px; }
    .search-input {
      padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.875rem; width: 100%; max-width: 260px; outline: none; transition: all 0.15s;
    }
    .search-input:focus { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }
    .suppliers-table-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .suppliers-table { width: 100%; min-width: 900px; border-collapse: collapse; text-align: left; font-size: 0.875rem; }
    .suppliers-table th { background: #f9fafb; padding: 0.75rem 1rem; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; }
    .suppliers-table td { padding: 1rem; border-bottom: 1px solid #e5e7eb; color: #4b5563; vertical-align: middle; }
    .suppliers-table tr:last-child td { border-bottom: none; }
    .suppliers-table tr:hover td { background: #fdfefe; }
    .badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; display: inline-block; }
    .badge-active { background: #ecfdf5; color: #065f46; }
    .badge-inactive { background: #f3f4f6; color: #6b7280; }
    .btn { font-size: 0.8125rem; padding: 0.38rem 0.85rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-sm { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; white-space: nowrap; }
    .btn-sm i { margin-right: 0.3rem; }
    .actions-cell { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog { background: #fff; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .dialog h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 1.25rem; color: #111827; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group.full-width { grid-column: span 2; }
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
    .supplier-notes { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; color: #9ca3af; }
  `]
})
export class SuppliersListComponent implements OnInit {
  private service = inject(SuppliersService);
  private fb = inject(FormBuilder);
  connectivity = inject(ConnectivityService);

  suppliers = signal<Supplier[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');

  showForm = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  editingId = signal<number | null>(null);
  formLoading = signal(false);
  formError = signal<string | null>(null);

  supplierForm!: FormGroup;

  filteredSuppliers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.suppliers();
    return this.suppliers().filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
      (s.tax_id && s.tax_id.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
  }

  initForm(): void {
    this.supplierForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      contact_name: ['', [Validators.maxLength(200)]],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.maxLength(20)]],
      address: [''],
      city: ['', [Validators.maxLength(100)]],
      country: ['Bolivia', [Validators.required, Validators.maxLength(100)]],
      tax_id: ['', [Validators.maxLength(50)]],
      notes: [''],
      is_active: [true]
    });
  }

  loadSuppliers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al cargar los proveedores');
        this.loading.set(false);
      }
    });
  }

  openCreate(): void {
    this.formMode.set('create');
    this.editingId.set(null);
    this.supplierForm.reset({
      country: 'Bolivia',
      is_active: true
    });
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(supplier: Supplier): void {
    this.formMode.set('edit');
    this.editingId.set(supplier.id);
    this.supplierForm.patchValue({
      name: supplier.name,
      contact_name: supplier.contact_name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      country: supplier.country,
      tax_id: supplier.tax_id,
      notes: supplier.notes,
      is_active: supplier.is_active
    });
    this.formError.set(null);
    this.showForm.set(true);
  }

  onSubmit(): void {
    if (this.supplierForm.invalid) return;

    this.formLoading.set(true);
    this.formError.set(null);
    const formValue = this.supplierForm.value;

    if (this.formMode() === 'create') {
      this.service.createSupplier(formValue).subscribe({
        next: (newSupplier) => {
          this.suppliers.update(list => [...list, newSupplier].sort((a,b) => a.name.localeCompare(b.name)));
          this.showForm.set(false);
          this.formLoading.set(false);
        },
        error: (err) => {
          this.formError.set(err.error?.detail || 'Error al crear el proveedor');
          this.formLoading.set(false);
        }
      });
    } else {
      const id = this.editingId();
      if (!id) return;
      this.service.updateSupplier(id, formValue).subscribe({
        next: (updatedSupplier) => {
          this.suppliers.update(list => list.map(s => s.id === id ? updatedSupplier : s).sort((a,b) => a.name.localeCompare(b.name)));
          this.showForm.set(false);
          this.formLoading.set(false);
        },
        error: (err) => {
          this.formError.set(err.error?.detail || 'Error al actualizar el proveedor');
          this.formLoading.set(false);
        }
      });
    }
  }

  deleteSupplier(id: number): void {
    if (!confirm('¿Estás seguro de eliminar este proveedor? Si tiene productos asociados, la operación fallará y se recomendará desactivarlo.')) {
      return;
    }

    this.service.deleteSupplier(id).subscribe({
      next: () => {
        this.suppliers.update(list => list.filter(s => s.id !== id));
      },
      error: (err) => {
        alert(err.error?.detail || 'Error al eliminar el proveedor');
      }
    });
  }

  toggleActive(supplier: Supplier): void {
    this.service.updateSupplier(supplier.id, { is_active: !supplier.is_active }).subscribe({
      next: (updated) => {
        this.suppliers.update(list => list.map(s => s.id === supplier.id ? updated : s));
      },
      error: (err) => {
        alert(err.error?.detail || 'Error al actualizar estado del proveedor');
      }
    });
  }
}
