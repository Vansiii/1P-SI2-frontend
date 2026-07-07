import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { RealtimeEvent } from '../models/realtime-events.models';
import { Subject } from 'rxjs';
import { ToastService } from './toast.service';

export interface InventoryUpdateEvent {
  productId: number;
  productName: string;
  sku?: string;
  currentStock: number;
  minStock: number;
  type: 'stock_low' | 'stock_out' | 'stock_replenished';
  message: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  private readonly updatesSubject = new Subject<InventoryUpdateEvent>();
  readonly updates$ = this.updatesSubject.asObservable();

  readonly activeAlertsCount = signal<number>(0);

  constructor() {
    this.setupEventHandlers();
    this.destroyRef.onDestroy(() => {
      this.updatesSubject.complete();
    });
  }

  private setupEventHandlers(): void {
    const inventoryEvents = [
      'inventory.stock_low',
      'inventory.stock_out',
      'inventory.stock_replenished'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      inventoryEvents,
      (event: RealtimeEvent) => this.handleEvent(event.type, event)
    );

    this.destroyRef.onDestroy(() => unsubscribe());
  }

  private handleEvent(eventType: string, event: RealtimeEvent): void {
    const data = event.data || {};
    const update: InventoryUpdateEvent = {
      productId: data.product_id ?? 0,
      productName: data.product_name ?? 'Producto',
      sku: data.sku,
      currentStock: data.current_stock ?? 0,
      minStock: data.min_stock ?? 0,
      type: this.mapEventType(eventType),
      message: data.message ?? '',
      timestamp: event.timestamp ?? new Date().toISOString()
    };

    this.updatesSubject.next(update);

    // Show visual toast notification
    if (update.type === 'stock_out') {
      this.toast.error(`¡AGOTADO! ${update.productName} no tiene stock.`);
      this.activeAlertsCount.update(c => c + 1);
    } else if (update.type === 'stock_low') {
      this.toast.warning(`Stock Bajo: ${update.productName} tiene ${update.currentStock} unidades.`);
      this.activeAlertsCount.update(c => c + 1);
    } else if (update.type === 'stock_replenished') {
      this.toast.success(`Abastecido: ${update.productName} ahora tiene ${update.currentStock} unidades.`);
      this.activeAlertsCount.update(c => Math.max(0, c - 1));
    }
  }

  private mapEventType(eventType: string): InventoryUpdateEvent['type'] {
    switch (eventType) {
      case 'inventory.stock_out': return 'stock_out';
      case 'inventory.stock_low': return 'stock_low';
      case 'inventory.stock_replenished': return 'stock_replenished';
      default: return 'stock_low';
    }
  }
}
