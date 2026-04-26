import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { WebSocketService, ConnectionStatus } from '../../../core/services/websocket.service';

/**
 * Displays a small colored dot indicating the current WebSocket connection status.
 *
 * - 🟢 Green  → connected
 * - 🟡 Yellow → reconnecting
 * - 🔴 Red    → disconnected
 *
 * Usage: add `<app-connection-status />` to the main layout shell.
 */
@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (status$ | async; as status) {
      <span
        class="connection-status"
        [class]="'connection-status--' + status"
        [attr.aria-label]="statusLabel(status)"
        [title]="statusLabel(status)"
        role="status"
      >
        <span class="connection-status__dot" aria-hidden="true"></span>
        <span class="connection-status__label">{{ statusLabel(status) }}</span>
      </span>
    }
  `,
  styles: [`
    .connection-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 9999px;
      user-select: none;
    }

    .connection-status__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Connected — green */
    .connection-status--connected {
      color: #166534;
      background-color: #dcfce7;
    }
    .connection-status--connected .connection-status__dot {
      background-color: #16a34a;
      box-shadow: 0 0 0 2px #bbf7d0;
    }

    /* Reconnecting — yellow */
    .connection-status--reconnecting {
      color: #854d0e;
      background-color: #fef9c3;
    }
    .connection-status--reconnecting .connection-status__dot {
      background-color: #ca8a04;
      box-shadow: 0 0 0 2px #fef08a;
      animation: pulse 1.2s ease-in-out infinite;
    }

    /* Disconnected — red */
    .connection-status--disconnected {
      color: #991b1b;
      background-color: #fee2e2;
    }
    .connection-status--disconnected .connection-status__dot {
      background-color: #dc2626;
      box-shadow: 0 0 0 2px #fecaca;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
  `],
})
export class ConnectionStatusComponent {
  private readonly wsService = inject(WebSocketService);

  readonly status$ = this.wsService.connectionStatus$;

  statusLabel(status: ConnectionStatus): string {
    switch (status) {
      case 'connected':     return 'Conectado';
      case 'reconnecting':  return 'Reconectando…';
      case 'disconnected':  return 'Desconectado';
    }
  }
}
