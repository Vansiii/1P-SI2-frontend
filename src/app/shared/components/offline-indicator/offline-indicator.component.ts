import { Component, inject, computed, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';
import { SyncStatusService } from '../../../core/services/sync-status.service';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  animations: [
    trigger('offlineSlide', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('0.3s ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('0.25s ease-in', style({ transform: 'translateY(100%)', opacity: 0 })),
      ]),
    ]),
    trigger('pulse', [
      transition('* => *', [animate('0.3s ease-in-out')]),
    ]),
  ],
  template: `
    @if (!connectivity.isOnline()) {
      <div class="offline-bar" [@offlineSlide]>
        <span class="offline-dot"></span>
        <span class="offline-msg">
          Sin conexion
          @if (pendingCount() > 0) {
            &mdash;
            @if (syncStatus.isSyncing()) {
              Sincronizando {{ pendingCount() }} pendiente(s)...
            } @else {
              {{ pendingCount() }} operacion(es) guardada(s)
            }
          }
        </span>
        @if (!syncStatus.isSyncing() && pendingCount() > 0) {
          <button class="offline-retry" (click)="forceSync()">
            Reintentar
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .offline-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      display: flex; align-items: center; gap: 10px;
      padding: 10px 20px; background: #1f2937; color: #f9fafb;
      font-size: 13px; font-weight: 500;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.2);
    }

    .offline-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #ef4444; flex-shrink: 0;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .offline-msg { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .offline-retry {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
      color: #fff; padding: 5px 12px; border-radius: 5px;
      cursor: pointer; font-size: 12px; font-weight: 600;
      white-space: nowrap; transition: background 0.15s;
    }
    .offline-retry:hover { background: rgba(255,255,255,0.25); }
  `],
})
export class OfflineIndicatorComponent {
  readonly connectivity = inject(ConnectivityService);
  readonly queue = inject(OfflineQueueService);
  readonly syncStatus = inject(SyncStatusService);

  readonly pendingCount = computed(() => this.syncStatus.pendingCount());

  forceSync(): void { void this.queue.processQueue(); }
}
