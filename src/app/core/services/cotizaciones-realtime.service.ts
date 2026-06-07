import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { RealtimeEvent } from '../models/realtime-events.models';
import { Subject } from 'rxjs';

export interface CotizacionUpdate {
  cotizacionId: number;
  updateType: 'solicitada' | 'respuesta_recibida' | 'taller_seleccionado' | 'pago_iniciado' | 'pago_confirmado' | 'cancelada';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class CotizacionesRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly updatesSubject = new Subject<CotizacionUpdate>();
  readonly updates$ = this.updatesSubject.asObservable();

  private readonly toastSubject = new Subject<CotizacionUpdate>();
  readonly toastNotifications$ = this.toastSubject.asObservable();

  readonly recentUpdates = signal<CotizacionUpdate[]>([]);

  constructor() {
    this.setupEventHandlers();
    this.destroyRef.onDestroy(() => {
      this.updatesSubject.complete();
      this.toastSubject.complete();
    });
  }

  private setupEventHandlers(): void {
    const cotizacionEvents = [
      'cotizacion.solicitada',
      'cotizacion.respuesta_recibida',
      'cotizacion.taller_seleccionado',
      'cotizacion.pago_iniciado',
      'cotizacion.pago_confirmado',
      'cotizacion.cancelada',
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      cotizacionEvents,
      (event: RealtimeEvent) => this.handleEvent(event.type, event)
    );

    this.destroyRef.onDestroy(() => unsubscribe());
  }

  private handleEvent(eventType: string, event: RealtimeEvent): void {
    const update: CotizacionUpdate = {
      cotizacionId: event.data?.cotizacion_id ?? event.data?.cotizacionId ?? 0,
      updateType: this.mapEventType(eventType),
      message: event.data?.message ?? '',
      timestamp: event.timestamp ?? new Date().toISOString(),
      data: event.data,
    };

    this.updatesSubject.next(update);
    this.toastSubject.next(update);

    const recent = this.recentUpdates();
    const updated = [update, ...recent.slice(0, 19)];
    this.recentUpdates.set(updated);
  }

  private mapEventType(eventType: string): CotizacionUpdate['updateType'] {
    switch (eventType) {
      case 'cotizacion.solicitada': return 'solicitada';
      case 'cotizacion.respuesta_recibida': return 'respuesta_recibida';
      case 'cotizacion.taller_seleccionado': return 'taller_seleccionado';
      case 'cotizacion.pago_iniciado': return 'pago_iniciado';
      case 'cotizacion.pago_confirmado': return 'pago_confirmado';
      case 'cotizacion.cancelada': return 'cancelada';
      default: return 'solicitada';
    }
  }
}
