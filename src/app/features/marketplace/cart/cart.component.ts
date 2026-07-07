import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ShoppingCart, CartItem } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';

interface GroupedCart {
  workshopName: string;
  items: CartItem[];
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.component.html',
  styles: [`
    .cart-container { padding: 1.5rem; max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; }
    .cart-main { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .checkout-sidebar { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); height: fit-content; }
    
    .btn { font-size: 0.8125rem; padding: 0.45rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 600; text-align: center; width: 100%; display: block; box-sizing: border-box; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    
    .qty-btn { border: none; background: #f3f4f6; width: 24px; height: 24px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
    .qty-btn:hover { background: #e5e7eb; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; grid-column: 1 / -1; }
    .workshop-group { border: 1px solid #f3f4f6; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
  `]
})
export class CartComponent implements OnInit {
  private service = inject(CartService);
  private toast = inject(ToastService);
  private router = inject(Router);

  cart = this.service.cart;
  loading = signal(true);
  validationErrors = signal<any[]>([]);

  groupedItems = computed<GroupedCart[]>(() => {
    const data = this.cart();
    if (!data || !data.items) return [];

    const map = new Map<string, CartItem[]>();
    for (const item of data.items) {
      const key = item.workshop_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    const res: GroupedCart[] = [];
    map.forEach((items, workshopName) => {
      res.push({ workshopName, items });
    });
    return res;
  });

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    this.loading.set(true);
    this.service.getCart().subscribe({
      next: () => {
        this.loading.set(false);
        this.validateCartStock();
      },
      error: () => this.loading.set(false)
    });
  }

  changeQty(item: CartItem, delta: number): void {
    const nextQty = item.quantity + delta;
    if (nextQty <= 0) {
      this.removeItem(item.id);
      return;
    }
    
    if (nextQty > item.current_stock) {
      this.toast.error(`No hay suficiente stock. Límite: ${item.current_stock} unidades.`);
      return;
    }

    this.service.updateItem(item.id, nextQty).subscribe({
      next: () => {
        this.toast.success('Carrito actualizado.');
        this.validateCartStock();
      },
      error: (err) => this.toast.error(err.error?.detail || 'Error al actualizar.')
    });
  }

  removeItem(itemId: number): void {
    this.service.removeItem(itemId).subscribe({
      next: () => {
        this.toast.success('Producto eliminado del carrito.');
        this.validateCartStock();
      },
      error: () => this.toast.error('Error al eliminar producto.')
    });
  }

  clearCart(): void {
    if (!confirm('¿Está seguro de que desea vaciar el carrito?')) return;
    this.service.clearCart().subscribe({
      next: () => {
        this.toast.success('Carrito vaciado.');
        this.validationErrors.set([]);
      },
      error: () => this.toast.error('Error.')
    });
  }

  validateCartStock(): void {
    this.service.validateCart().subscribe({
      next: (res: any) => {
        this.validationErrors.set(res.warnings || []);
      },
      error: () => {}
    });
  }

  isItemWarning(itemId: number): string | null {
    const warn = this.validationErrors().find(w => w.item_id === itemId);
    return warn ? warn.error : null;
  }

  proceedToCheckout(): void {
    if (this.validationErrors().length > 0) {
      this.toast.error('Por favor resuelva las alertas de stock antes de proceder al checkout.');
      return;
    }
    this.router.navigate(['/marketplace/checkout']);
  }
}
