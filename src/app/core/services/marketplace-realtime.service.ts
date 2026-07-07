import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { RealtimeEvent } from '../models/realtime-events.models';
import { Subject } from 'rxjs';
import { ToastService } from './toast.service';

export interface MarketplaceRealtimeEvent {
  orderId?: number;
  orderNumber?: string;
  listingId?: number;
  status?: string;
  message: string;
  timestamp: string;
  type: 'order_created' | 'status_changed' | 'payment_confirmed' | 'product_updated';
}

@Injectable({ providedIn: 'root' })
export class MarketplaceRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  private readonly updatesSubject = new Subject<MarketplaceRealtimeEvent>();
  readonly updates$ = this.updatesSubject.asObservable();

  constructor() {
    this.setupEventHandlers();
    this.destroyRef.onDestroy(() => {
      this.updatesSubject.complete();
    });
  }

  private setupEventHandlers(): void {
    const marketplaceEvents = [
      'order.created',
      'order.status_changed',
      'order.payment_confirmed',
      'marketplace.product_updated'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      marketplaceEvents,
      (event: RealtimeEvent) => this.handleEvent(event.type, event)
    );

    this.destroyRef.onDestroy(() => unsubscribe());
  }

  private handleEvent(eventType: string, event: RealtimeEvent): void {
    const data = event.data || {};
    const update: MarketplaceRealtimeEvent = {
      orderId: data.order_id ?? data.orderId,
      orderNumber: data.order_number ?? data.orderNumber,
      listingId: data.listing_id ?? data.listingId,
      status: data.status,
      message: data.message ?? '',
      timestamp: event.timestamp ?? new Date().toISOString(),
      type: this.mapEventType(eventType)
    };

    this.updatesSubject.next(update);

    // Show visual toasts depending on event type
    if (update.type === 'order_created') {
      this.toast.success(`Nueva orden recibida: ${update.orderNumber}.`, 5000);
    } else if (update.type === 'payment_confirmed') {
      this.toast.success(`Pago confirmado para orden ${update.orderNumber}.`, 4000);
    } else if (update.type === 'status_changed') {
      this.toast.info(`Estado de orden ${update.orderNumber} cambiado a: ${update.status}.`);
    } else if (update.type === 'product_updated') {
      // Background listings update notice (optional toast or silent signal)
    }
  }

  private mapEventType(eventType: string): MarketplaceRealtimeEvent['type'] {
    switch (eventType) {
      case 'order.created': return 'order_created';
      case 'order.status_changed': return 'status_changed';
      case 'order.payment_confirmed': return 'payment_confirmed';
      case 'marketplace.product_updated': return 'product_updated';
      default: return 'status_changed';
    }
  }
}
