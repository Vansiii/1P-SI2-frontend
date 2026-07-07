import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { UploadService } from '../../../core/services/upload.service';
import { InventoryCategory } from '../../../core/models/inventory.model';
import { Supplier } from '../../../core/models/supplier.model';
import { ConnectivityService } from '../../../core/services/connectivity.service';

@Component({
  selector: 'app-inventory-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './inventory-form.component.html',
  styles: [`
    .form-container { padding: 1.5rem; max-width: 800px; margin: 0 auto; }
    .form-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { margin-bottom: 1.25rem; }
    .form-group.full-width { grid-column: span 2; }
    .form-group label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.35rem; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; padding: 0.55rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.875rem; outline: none; box-sizing: border-box; transition: all 0.15s;
    }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
      border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15);
    }
    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; border-top: 1px solid #f3f4f6; padding-top: 1.25rem; }
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.25rem; font-size: 0.875rem; }
    .alert-error { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    
    /* Compatibility grid tags */
    .tags-container { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
    .tag { background: #f3f4f6; border-radius: 0.25rem; padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #374151; display: flex; align-items: center; gap: 0.25rem; }
    .tag i { cursor: pointer; color: #9ca3af; }
    .tag i:hover { color: #dc2626; }
    .add-tag-box { display: flex; gap: 0.25rem; margin-top: 0.35rem; }
    .add-tag-input { flex: 1; padding: 0.35rem 0.5rem !important; font-size: 0.75rem !important; }

    /* Image upload widget */
    .image-upload-area { margin-top: 0.35rem; }
    .image-upload-label {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.35rem; padding: 1.5rem; border: 2px dashed #d1d5db; border-radius: 0.5rem;
      cursor: pointer; background: #f9fafb; transition: all 0.15s;
    }
    .image-upload-label:hover { border-color: #f97316; background: #fff7ed; }
    .image-input { display: none; }
    .upload-text { font-size: 0.8125rem; color: #4b5563; margin: 0; font-weight: 500; }
    .upload-hint { font-size: 0.75rem; color: #9ca3af; margin: 0; }
    .image-preview-container { position: relative; width: 100%; max-width: 220px; }
    .image-preview { width: 100%; max-width: 220px; height: 160px; object-fit: cover; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
    .upload-overlay {
      position: absolute; inset: 0; background: rgba(255,255,255,0.85); display: flex;
      flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem;
      border-radius: 0.5rem; font-size: 0.75rem; color: #4b5563;
    }
    .spinner { width: 1.5rem; height: 1.5rem; border: 3px solid #f3f4f6; border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-remove-image {
      position: absolute; top: -8px; right: -8px; width: 1.75rem; height: 1.75rem; border-radius: 50%;
      background: #dc2626; color: #fff; border: 2px solid #fff; cursor: pointer; display: flex;
      align-items: center; justify-content: center; font-size: 0.875rem; line-height: 1;
    }
    .btn-remove-image:hover { background: #b91c1c; }
    .upload-divider { display: flex; align-items: center; gap: 0.5rem; margin: 0.75rem 0; font-size: 0.7rem; color: #9ca3af; text-transform: uppercase; }
    .upload-divider::before, .upload-divider::after { content: ""; flex: 1; height: 1px; background: #e5e7eb; }
  `]
})
export class InventoryFormComponent implements OnInit {
  private service = inject(InventoryService);
  private suppliersService = inject(SuppliersService);
  private uploadService = inject(UploadService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  connectivity = inject(ConnectivityService);

  formMode = signal<'create' | 'edit'>('create');
  productId = signal<number | null>(null);
  categories = signal<InventoryCategory[]>([]);
  suppliers = signal<Supplier[]>([]);
  loading = signal(false);
  submitLoading = signal(false);
  error = signal<string | null>(null);

  // Image upload state
  isUploadingImage = signal(false);
  imagePreview = signal<string | null>(null);
  uploadError = signal<string | null>(null);

  productForm!: FormGroup;

  // Compatibility signal buffers
  compatibleBrands = signal<string[]>([]);
  compatibleModels = signal<string[]>([]);

  brandInput = signal('');
  modelInput = signal('');

  ngOnInit(): void {
    this.initForm();
    this.loadDropdownData();
    this.checkRoute();
  }

  initForm(): void {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(300)]],
      description: [''],
      sku: ['', [Validators.maxLength(50)]],
      barcode: ['', [Validators.maxLength(50)]],
      brand: ['', [Validators.maxLength(100)]],
      part_number: ['', [Validators.maxLength(100)]],
      category_id: [null],
      supplier_id: [null],
      current_stock: [0, [Validators.required, Validators.min(0)]],
      min_stock: [0, [Validators.required, Validators.min(0)]],
      max_stock: [null, [Validators.min(0)]],
      unit: ['unidad', [Validators.required, Validators.maxLength(20)]],
      location: ['', [Validators.maxLength(100)]],
      cost_price: [0.0, [Validators.required, Validators.min(0)]],
      universal: [false],
      image_url: ['']
    });
  }

  loadDropdownData(): void {
    this.service.listCategories().subscribe({
      next: (data) => this.categories.set(data)
    });
    this.suppliersService.listSuppliers().subscribe({
      next: (data) => this.suppliers.set(data)
    });
  }

  checkRoute(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.formMode.set('edit');
      this.productId.set(+id);
      this.loadProduct(+id);
      
      // En modo edición no dejamos cambiar el stock inicial directamente (se hace vía movimientos)
      this.productForm.get('current_stock')?.disable();
    }
  }

  loadProduct(id: number): void {
    this.loading.set(true);
    this.service.getProduct(id).subscribe({
      next: (product) => {
        this.productForm.patchValue({
          name: product.name,
          description: product.description,
          sku: product.sku,
          barcode: product.barcode,
          brand: product.brand,
          part_number: product.part_number,
          category_id: product.category_id,
          supplier_id: product.supplier_id,
          current_stock: product.current_stock,
          min_stock: product.min_stock,
          max_stock: product.max_stock,
          unit: product.unit,
          location: product.location,
          cost_price: product.cost_price,
          universal: product.universal,
          image_url: product.image_url
        });
        
        this.compatibleBrands.set(product.compatible_brands || []);
        this.compatibleModels.set(product.compatible_models || []);
        this.imagePreview.set(product.image_url || null);

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al cargar los datos del producto');
        this.loading.set(false);
      }
    });
  }

  // Compatibility handlers
  addBrand(): void {
    const brand = this.brandInput().trim();
    if (brand && !this.compatibleBrands().includes(brand)) {
      this.compatibleBrands.update(list => [...list, brand]);
      this.brandInput.set('');
    }
  }

  removeBrand(brand: string): void {
    this.compatibleBrands.update(list => list.filter(b => b !== brand));
  }

  addModel(): void {
    const model = this.modelInput().trim();
    if (model && !this.compatibleModels().includes(model)) {
      this.compatibleModels.update(list => [...list, model]);
      this.modelInput.set('');
    }
  }

  removeModel(model: string): void {
    this.compatibleModels.update(list => list.filter(m => m !== model));
  }

  // Image upload handlers
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Por favor selecciona un archivo de imagen válido.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('La imagen no debe superar los 5MB.');
      return;
    }

    this.uploadError.set(null);

    const reader = new FileReader();
    reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);

    this.isUploadingImage.set(true);
    this.uploadService.uploadProductImage(file).subscribe({
      next: (response) => {
        this.productForm.patchValue({ image_url: response.file_url });
        this.imagePreview.set(response.file_url);
        this.isUploadingImage.set(false);
      },
      error: (err) => {
        this.isUploadingImage.set(false);
        this.uploadError.set(err.error?.detail || 'Error al subir la imagen. Intenta de nuevo.');
      }
    });
  }

  removeImage(): void {
    this.imagePreview.set(null);
    this.uploadError.set(null);
    this.productForm.patchValue({ image_url: '' });
  }

  onSubmit(): void {
    if (this.productForm.invalid) return;

    this.submitLoading.set(true);
    this.error.set(null);

    // Get raw value because current_stock might be disabled in edit mode
    const formValue = this.productForm.getRawValue();
    const requestData = {
      ...formValue,
      category_id: formValue.category_id ? +formValue.category_id : null,
      supplier_id: formValue.supplier_id ? +formValue.supplier_id : null,
      compatible_brands: this.compatibleBrands(),
      compatible_models: this.compatibleModels()
    };

    if (this.formMode() === 'create') {
      this.service.createProduct(requestData).subscribe({
        next: () => {
          this.submitLoading.set(false);
          this.router.navigate(['/workshop/inventory']);
        },
        error: (err) => {
          this.error.set(err.error?.detail || 'Error al registrar el producto');
          this.submitLoading.set(false);
        }
      });
    } else {
      const id = this.productId();
      if (!id) return;
      this.service.updateProduct(id, requestData).subscribe({
        next: () => {
          this.submitLoading.set(false);
          this.router.navigate(['/workshop/inventory']);
        },
        error: (err) => {
          this.error.set(err.error?.detail || 'Error al actualizar el producto');
          this.submitLoading.set(false);
        }
      });
    }
  }
}
