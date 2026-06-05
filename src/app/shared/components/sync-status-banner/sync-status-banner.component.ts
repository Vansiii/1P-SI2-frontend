import { Component, inject, signal, effect, OnDestroy } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { SyncStatusService } from '../../../core/services/sync-status.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

type BannerState = 'hidden' | 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

@Component({
  selector: 'app-sync-status-banner',
  standalone: true,
  animations: [
    trigger('bannerAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('0.3s ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('0.25s ease-in', style({ transform: 'translateY(-100%)', opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    @if (state() !== 'hidden') {
      <div
        class="sync-banner"
        [class.syncing]="state() === 'syncing'"
        [class.synced]="state() === 'synced'"
        [class.failed]="state() === 'failed'"
        [class.pending]="state() === 'pending'"
        [class.conflict]="state() === 'conflict'"
        [@bannerAnimation]
        role="status"
        aria-live="polite"
      >
        <span class="banner-icon">{{ statusIcon() }}</span>
        <div class="banner-content">
          <span class="banner-title">{{ statusTitle() }}</span>
          <span class="banner-sub">{{ statusSubtitle() }}</span>
        </div>
        @if (state() === 'syncing') {
          <div class="banner-progress">
            <div class="progress-bar" [style.width.%]="progressPercent()"></div>
          </div>
        }
        @if (state() === 'failed') {
          <button class="banner-action" (click)="retry()">
            Reintentar ahora
          </button>
        }
        @if (state() === 'conflict') {
          <button class="banner-action" (click)="retry()">
            Revisar
          </button>
        }
        @if (canDismiss()) {
          <button class="banner-close" (click)="dismissBanner()" aria-label="Cerrar">
            &times;
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .sync-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 20px 16px;
      font-size: 14px; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .sync-banner.pending  { background: #fef3c7; color: #92400e; }
    .sync-banner.syncing  { background: #3b82f6; color: #fff; }
    .sync-banner.synced   { background: #22c55e; color: #fff; }
    .sync-banner.failed   { background: #ef4444; color: #fff; }
    .sync-banner.conflict { background: #f59e0b; color: #fff; }

    .banner-icon { font-size: 22px; line-height: 1; flex-shrink: 0; margin-top: 1px; }

    .banner-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .banner-title  { font-weight: 600; }
    .banner-sub    { font-size: 12px; opacity: 0.9; }

    .banner-progress {
      position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
      background: rgba(255,255,255,0.2);
    }
    .progress-bar {
      height: 100%; background: rgba(255,255,255,0.8);
      transition: width 0.5s ease-out;
    }

    .banner-action {
      background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
      color: inherit; padding: 6px 14px; border-radius: 6px;
      cursor: pointer; font-size: 13px; font-weight: 600; white-space: nowrap;
      transition: background 0.15s;
    }
    .banner-action:hover { background: rgba(255,255,255,0.3); }

    .banner-close {
      background: none; border: none; color: inherit; font-size: 20px;
      cursor: pointer; opacity: 0.7; line-height: 1; padding: 0 4px;
      flex-shrink: 0;
    }
    .banner-close:hover { opacity: 1; }
  `],
})
export class SyncStatusBannerComponent implements OnDestroy {
  private readonly syncStatus = inject(SyncStatusService);
  private readonly queue = inject(OfflineQueueService);

  private readonly SYNCED_AUTO_DISMISS_MS = 3000;
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = signal<BannerState>('hidden');
  readonly progressPercent = signal(0);

  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const isSyncing = this.syncStatus.isSyncing();
      const pending = this.syncStatus.pendingCount();
      const lastError = this.syncStatus.lastError();
      const lastSync = this.syncStatus.lastSyncAt();
      const lastSuccessfulCount = this.syncStatus.lastSuccessfulCount();

      if (isSyncing) {
        this._transitionTo('syncing');
        this._startProgress();
        return;
      }

      this._stopProgress();

      if (pending > 0) {
        this._transitionTo('pending');
        return;
      }

      if (lastError) {
        this._transitionTo('failed');
        return;
      }

      if (lastSync && lastSuccessfulCount > 0) {
        this._transitionTo('synced');
        this._scheduleAutoDismiss();
        return;
      }

      if (pending === 0 && this.state() !== 'hidden') {
        this._transitionTo('hidden');
      }
    });

    this.syncStatus.syncEvent$.subscribe((event) => {
      if (event.type === 'conflict_detected') {
        this._transitionTo('conflict');
      }
    });
  }

  ngOnDestroy(): void {
    this._stopProgress();
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
  }

  get canDismiss(): () => boolean {
    return () => this.state() === 'synced' || this.state() === 'pending';
  }

  statusIcon(): string {
    const s = this.state();
    if (s === 'pending' || s === 'syncing') return '\u23F3';
    if (s === 'synced') return '\u2705';
    if (s === 'failed') return '\u26A0\uFE0F';
    if (s === 'conflict') return '\u26A1';
    return '';
  }

  statusTitle(): string {
    const s = this.state();
    if (s === 'pending') return 'Operaciones pendientes';
    if (s === 'syncing') return 'Sincronizando...';
    if (s === 'synced') return 'Sincronización completa';
    if (s === 'failed') return 'Error de sincronización';
    if (s === 'conflict') return 'Conflictos detectados';
    return '';
  }

  statusSubtitle(): string {
    const s = this.state();
    const count = this.syncStatus.pendingCount();
    const syncedCount = this.syncStatus.lastSuccessfulCount();
    if (s === 'pending') return `${count} operacione(s) guardadas localmente`;
    if (s === 'syncing') return `Enviando ${count} operacione(s)...`;
    if (s === 'synced') return `${syncedCount} operacione(s) sincronizadas correctamente`;
    if (s === 'failed') return this.syncStatus.lastError() ?? 'No se pudo contactar al servidor';
    if (s === 'conflict') return 'Algunas operaciones no pudieron completarse';
    return '';
  }

  retry(): void { void this.queue.processQueue(); }

  dismissBanner(): void {
    if (this.state() === 'synced') {
      this._transitionTo('hidden');
    }
  }

  private _transitionTo(newState: BannerState): void {
    if (newState !== 'synced' && this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
    this.state.set(newState);
  }

  private _scheduleAutoDismiss(): void {
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = setTimeout(() => {
      this._transitionTo('hidden');
    }, this.SYNCED_AUTO_DISMISS_MS);
  }

  private _startProgress(): void {
    this._stopProgress();
    this.progressPercent.set(0);
    this.progressTimer = setInterval(() => {
      const p = this.progressPercent();
      if (p < 90) {
        this.progressPercent.update(v => Math.min(v + (100 - v) * 0.15, 90));
      }
    }, 400);
  }

  private _stopProgress(): void {
    if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; }
    this.progressPercent.set(100);
  }
}
