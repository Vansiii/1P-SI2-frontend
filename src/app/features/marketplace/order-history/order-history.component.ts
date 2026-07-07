import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrdersService } from '../../../core/services/orders.service';
import { MarketplaceOrder } from '../../../core/models/marketplace.model';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-history.component.html',
  styles: [`
    .history-container { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .order-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 1rem; transition: transform 0.15s; }
    .order-card:hover { transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); }
    
    .btn { font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 0.375rem; border: 1px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; font-weight: 600; display: inline-block; text-align: center; }
    .btn:hover { background: #f9fafb; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; border-color: #ea580c; }
    .btn-danger { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
    .btn-danger:hover { background: #fecaca; }

    .badge { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 9999px; font-weight: 600; display: inline-block; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-preparing { background: #e0f2fe; color: #075985; }
    .badge-ready { background: #faf5ff; color: #5b21b6; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    
    .loading-container { text-align: center; padding: 4rem; color: #9ca3af; }
    
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; border-radius: 0.75rem; width: 100%; max-width: 400px; padding: 1.5rem; }
    #card-element { padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: #fff; margin-top: 0.5rem; }
  `]
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  private service = inject(OrdersService);
  private toast = inject(ToastService);

  orders = signal<MarketplaceOrder[]>([]);
  loading = signal(true);
  payLoading = signal(false);

  // Stripe pay-later properties
  stripe: any;
  elements: any;
  cardElement: any;
  selectedOrderForPayment = signal<MarketplaceOrder | null>(null);
  stripeError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadOrders();
    this.loadStripeScript();
  }

  ngOnDestroy(): void {
    if (this.cardElement) {
      this.cardElement.destroy();
    }
  }

  loadOrders(): void {
    this.loading.set(true);
    this.service.listClientOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadStripeScript(): void {
    if ((window as any).Stripe) {
      this.initializeStripe();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => this.initializeStripe();
    document.head.appendChild(script);
  }

  initializeStripe(): void {
    const key = environment.stripePublishableKey;
    if (!key) return;
    this.stripe = (window as any).Stripe(key);
    this.elements = this.stripe.elements();
  }

  openPaymentModal(order: MarketplaceOrder): void {
    this.selectedOrderForPayment.set(order);
    this.stripeError.set(null);
    
    // Destroy previous card element if any
    if (this.cardElement) {
      this.cardElement.destroy();
    }

    setTimeout(() => {
      this.cardElement = this.elements.create('card', {
        style: {
          base: { color: '#1f2937', fontFamily: '"Outfit", sans-serif', fontSize: '14px' }
        }
      });
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

  submitPayment(): void {
    const order = this.selectedOrderForPayment();
    if (!order || !this.stripe || !this.cardElement) return;

    this.payLoading.set(true);
    this.service.payOrder(order.id).subscribe({
      next: (res) => {
        this.stripe.confirmCardPayment(res.client_secret, {
          payment_method: { card: this.cardElement }
        }).then((stripeResult: any) => {
          if (stripeResult.error) {
            this.stripeError.set(stripeResult.error.message);
            this.payLoading.set(false);
            this.toast.error('Pago fallido. Pruebe con otra tarjeta.');
          } else {
            if (stripeResult.paymentIntent.status === 'succeeded') {
              this.toast.success(`¡Pago completado para orden ${order.order_number}!`);
              this.payLoading.set(false);
              this.selectedOrderForPayment.set(null);
              this.loadOrders(); // reload
            }
          }
        });
      },
      error: (err) => {
        this.toast.error(err.error?.detail || 'No se pudo generar la orden de pago.');
        this.payLoading.set(false);
      }
    });
  }

  translateStatus(status: string): string {
    switch (status) {
      case 'pending_payment': return 'Pendiente de Pago';
      case 'paid': return 'Pagado';
      case 'confirmed': return 'Confirmado por Taller';
      case 'preparing': return 'En Preparación';
      case 'ready_pickup': return 'Listo para Retiro';
      case 'shipped': return 'Despachado';
      case 'delivered': return 'Entregado';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      case 'refunded': return 'Cancelado y Reembolsado';
      default: return status;
    }
  }
}
