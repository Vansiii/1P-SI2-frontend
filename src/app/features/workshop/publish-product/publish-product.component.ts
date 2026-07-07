import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { ToastService } from '../../../core/services/toast.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-publish-product',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './publish-product.component.html',
  styles: [`
    .publish-container { padding: 1.5rem; max-width: 600px; margin: 0 auto; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; font-size: 0.8125rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-sizing: border-box; }
    
    .prod-summary { background: #f9fafb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; display: flex; gap: 0.75rem; align-items: center; border: 1px dashed #d1d5db; }
  `]
})
export class PublishProductComponent implements OnInit {
  private service = inject(MarketplaceService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  productId = signal<number | null>(null);
  productData = signal<any | null>(null);
  loading = signal(true);
  submitLoading = signal(false);
  publishForm!: FormGroup;

  ngOnInit(): void {
    const idParam = this.route.snapshot.queryParamMap.get('productId');
    if (!idParam) {
      this.toast.error('Debe seleccionar un producto de su inventario para publicarlo.');
      this.router.navigate(['/workshop/inventory']);
      return;
    }

    this.productId.set(parseInt(idParam, 10));
    this.loadProductDetails();

    this.publishForm = this.fb.group({
      public_price: [null, [Validators.required, Validators.min(0.01)]],
      compare_at_price: [null],
      title: ['', [Validators.required, Validators.maxLength(300)]],
      description: [''],
      shipping_available: [false],
      shipping_cost: [0.0, [Validators.min(0)]],
      pickup_only: [true]
    });
  }

  loadProductDetails(): void {
    this.loading.set(true);
    // Fetch product details directly from the inventory endpoint
    this.http.get<{ data: any }>(`${environment.apiUrl}/workshop/inventory/products/${this.productId()}`).pipe(
      map(res => res.data)
    ).subscribe({
      next: (product) => {
        this.productData.set(product);
        this.publishForm.patchValue({
          title: product.name,
          description: product.description || '',
          public_price: product.cost_price ? Number(product.cost_price) * 1.3 : null // suggest a 30% margin by default
        });
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo obtener la información del producto de inventario.');
        this.router.navigate(['/workshop/inventory']);
      }
    });
  }

  onSubmit(): void {
    if (this.publishForm.invalid) return;
    this.submitLoading.set(true);

    const payload = {
      product_id: this.productId(),
      ...this.publishForm.value
    };

    this.service.createListing(payload).subscribe({
      next: () => {
        this.toast.success('Repuesto publicado en el marketplace exitosamente.');
        this.submitLoading.set(false);
        this.router.navigate(['/workshop/marketplace/products']);
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'Error al publicar repuesto.');
        this.submitLoading.set(false);
      }
    });
  }
}
