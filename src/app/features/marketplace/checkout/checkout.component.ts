import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../../core/services/cart.service';
import { OrdersService } from '../../../core/services/orders.service';
import { ShoppingCart, MarketplaceOrder } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './checkout.component.html',
  styles: [`
    .checkout-container { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem; }
    
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1rem; }
    .btn { font-size: 0.8125rem; padding: 0.5rem 1.1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 600; text-align: center; width: 100%; display: block; box-sizing: border-box; }
    .btn:hover { background: #f9fafb; border-color: #c1c5cb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-primary:disabled { background: #ffedd5; color: #ffb07c; border-color: #ffedd5; cursor: not-allowed; }

    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; font-size: 0.8125rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-sizing: border-box; }
    
    #card-element { padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: #fff; }
    .stripe-errors { color: #dc2626; font-size: 0.75rem; margin-top: 0.5rem; }
    
    .order-item-summary { display: flex; justify-content: space-between; font-size: 0.8125rem; padding: 0.35rem 0; border-bottom: 1px solid #f3f4f6; }
  `]
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private cartService = inject(CartService);
  private ordersService = inject(OrdersService);
  private toast = inject(ToastService);
  private router = inject(Router);

  cart = this.cartService.cart;
  loading = signal(true);
  checkoutLoading = signal(false);
  paymentLoading = signal(false);

  // Delivery options
  deliveryType = signal<string>('pickup');
  deliveryAddress = signal<string>('');
  deliveryNotes = signal<string>('');

  // Stripe elements properties
  stripe: any;
  elements: any;
  cardElement: any;
  stripeError = signal<string | null>(null);

  // Checkout order results (if they need payment)
  createdOrders = signal<MarketplaceOrder[]>([]);
  currentPaymentOrder = signal<MarketplaceOrder | null>(null);

  ngOnInit(): void {
    if (!this.cart() || this.cart()!.items.length === 0) {
      this.cartService.getCart().subscribe({
        next: (c) => {
          if (c.items.length === 0) {
            this.toast.error('Su carrito está vacío.');
            this.router.navigate(['/marketplace/browse']);
          } else {
            this.loading.set(false);
            this.loadStripeScript();
          }
        },
        error: () => this.router.navigate(['/marketplace/cart'])
      });
    } else {
      this.loading.set(false);
      this.loadStripeScript();
    }
  }

  ngOnDestroy(): void {
    if (this.cardElement) {
      this.cardElement.destroy();
    }
  }

  loadStripeScript(): void {
    if ((window as any).Stripe) {
      this.initializeStripe();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => this.initializeStripe();
    document.head.appendChild(script);
  }

  initializeStripe(): void {
    const key = environment.stripePublishableKey;
    if (!key) {
      return;
    }
    this.stripe = (window as any).Stripe(key);
    this.elements = this.stripe.elements();
  }

  mountStripeCard(): void {
    if (!this.elements) return;

    // Destroy existing if any
    if (this.cardElement) {
      this.cardElement.destroy();
    }

    this.cardElement = this.elements.create('card', {
      style: {
        base: {
          color: '#1f2937',
          fontFamily: '"Outfit", sans-serif',
          fontSmoothing: 'antialiased',
          fontSize: '14px',
          '::placeholder': { color: '#9ca3af' }
        },
        invalid: { color: '#dc2626', iconColor: '#dc2626' }
      }
    });

    // Mount to division
    setTimeout(() => {
      this.cardElement.mount('#card-element');
      this.cardElement.on('change', (event: any) => {
        if (event.error) {
          this.stripeError.set(event.error.message);
        } else {
          this.stripeError.set(null);
        }
      });
    }, 100);
  }

  onSubmitCheckout(): void {
    if (this.deliveryType() === 'shipping' && !this.deliveryAddress().trim()) {
      this.toast.error('Debe ingresar una dirección física para el envío.');
      return;
    }

    this.checkoutLoading.set(true);
    const payload = {
      delivery_type: this.deliveryType(),
      delivery_address: this.deliveryType() === 'shipping' ? this.deliveryAddress() : undefined,
      delivery_notes: this.deliveryNotes() || undefined
    };

    this.ordersService.checkoutCart(payload).subscribe({
      next: (orders) => {
        this.createdOrders.set(orders);
        this.cartService.cart.set(null); // clear local cart signal
        this.checkoutLoading.set(false);
        this.toast.success('Órdenes de compra creadas exitosamente.');
        
        // Start processing payment for the first order
        if (orders.length > 0) {
          this.currentPaymentOrder.set(orders[0]);
          this.mountStripeCard();
        }
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'Error al procesar el checkout.');
        this.checkoutLoading.set(false);
      }
    });
  }

  payCurrentOrder(): void {
    const order = this.currentPaymentOrder();
    if (!order || !this.stripe || !this.cardElement) return;

    this.paymentLoading.set(true);
    this.stripeError.set(null);

    // 1. Get payment intent client secret
    this.ordersService.payOrder(order.id).subscribe({
      next: (res) => {
        // 2. Confirm card payment with Stripe client
        this.stripe.confirmCardPayment(res.client_secret, {
          payment_method: {
            card: this.cardElement
          }
        }).then((stripeResult: any) => {
          if (stripeResult.error) {
            this.stripeError.set(stripeResult.error.message);
            this.paymentLoading.set(false);
            this.toast.error('Pago fallido. Por favor intente con otra tarjeta.');
          } else {
            if (stripeResult.paymentIntent.status === 'succeeded') {
              this.toast.success(`Pago exitoso para orden ${order.order_number}!`);
              this.paymentLoading.set(false);
              this.advancePaymentQueue();
            }
          }
        });
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'No se pudo generar la orden de pago.');
        this.paymentLoading.set(false);
      }
    });
  }

  advancePaymentQueue(): void {
    const ordersList = this.createdOrders();
    const current = this.currentPaymentOrder();
    if (!current) return;

    // Find current index
    const idx = ordersList.findIndex(o => o.id === current.id);
    if (idx === -1 || idx === ordersList.length - 1) {
      // Finished all payments! Redirect to order history
      this.toast.success('¡Todos sus pagos fueron procesados correctamente!');
      this.router.navigate(['/marketplace/my-purchases']);
    } else {
      // Set next order to pay
      const nextOrder = ordersList[idx + 1];
      this.currentPaymentOrder.set(nextOrder);
      this.mountStripeCard();
    }
  }

  skipPayment(): void {
    this.toast.info('Ha omitido el pago inmediato. Puede pagar sus órdenes pendientes desde su historial de compras.');
    this.router.navigate(['/marketplace/my-purchases']);
  }
}
