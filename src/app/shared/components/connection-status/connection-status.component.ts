import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService, ConnectionStatus } from '../../../core/services/websocket.service';

/**
 * Connection Status Component
 * 
 * Displays the current WebSocket connection status to the user.
 * Shows different states: connected, connecting, reconnecting, disconnected, error.
 * 
 * Usage:
 * ```html
 * <app-connection-status />
 * ```
 */
@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="connection-status" [attr.data-status]="connectionState()">
      @switch (connectionState()) {
        @case ('connected') {
          <div class="status-indicator connected">
            <span class="status-dot"></span>
            <span class="status-text">En línea</span>
          </div>
        }
        @case ('connecting') {
          <div class="status-indicator connecting">
            <span class="status-dot"></span>
            <span class="status-text">Conectando...</span>
          </div>
        }
        @case ('reconnecting') {
          <div class="status-indicator reconnecting">
            <span class="status-dot"></span>
            <span class="status-text">Reconectando... ({{ reconnectAttempts() }}/10)</span>
          </div>
        }
        @case ('error') {
          <div class="status-indicator error">
            <span class="status-dot"></span>
            <span class="status-text">Sin conexión</span>
            <button 
              class="reconnect-btn" 
              (click)="reconnect()"
              type="button"
            >
              Reintentar
            </button>
          </div>
        }
        @case ('disconnected') {
          <div class="status-indicator disconnected">
            <span class="status-dot"></span>
            <span class="status-text">Desconectado</span>
            <button 
              class="reconnect-btn" 
              (click)="reconnect()"
              type="button"
            >
              Conectar
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .connection-status {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-size: 14px;
      transition: all 0.3s ease;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    /* Connected state */
    .status-indicator.connected {
      border-left: 3px solid #10b981;
    }

    .status-indicator.connected .status-dot {
      background: #10b981;
    }

    .status-indicator.connected .status-text {
      color: #059669;
    }

    /* Connecting state */
    .status-indicator.connecting {
      border-left: 3px solid #f59e0b;
    }

    .status-indicator.connecting .status-dot {
      background: #f59e0b;
    }

    .status-indicator.connecting .status-text {
      color: #d97706;
    }

    /* Reconnecting state */
    .status-indicator.reconnecting {
      border-left: 3px solid #3b82f6;
    }

    .status-indicator.reconnecting .status-dot {
      background: #3b82f6;
      animation: pulse 1s ease-in-out infinite;
    }

    .status-indicator.reconnecting .status-text {
      color: #2563eb;
    }

    /* Error state */
    .status-indicator.error {
      border-left: 3px solid #ef4444;
    }

    .status-indicator.error .status-dot {
      background: #ef4444;
      animation: none;
    }

    .status-indicator.error .status-text {
      color: #dc2626;
    }

    /* Disconnected state */
    .status-indicator.disconnected {
      border-left: 3px solid #6b7280;
    }

    .status-indicator.disconnected .status-dot {
      background: #6b7280;
      animation: none;
    }

    .status-indicator.disconnected .status-text {
      color: #4b5563;
    }

    /* Reconnect button */
    .reconnect-btn {
      margin-left: 8px;
      padding: 4px 12px;
      border: none;
      border-radius: 4px;
      background: #3b82f6;
      color: white;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .reconnect-btn:hover {
      background: #2563eb;
    }

    .reconnect-btn:active {
      background: #1d4ed8;
    }

    /* Pulse animation */
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    /* Hide completely when connected - only show when there are issues */
    .connection-status[data-status="connected"] {
      display: none;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .connection-status {
        bottom: 8px;
        right: 8px;
      }

      .status-indicator {
        padding: 6px 12px;
        font-size: 12px;
      }

      .status-dot {
        width: 6px;
        height: 6px;
      }

      .reconnect-btn {
        padding: 3px 8px;
        font-size: 11px;
      }
    }
  `]
})
export class ConnectionStatusComponent {
  private wsService = inject(WebSocketService);

  // Expose connection state from WebSocketService
  connectionState = this.wsService.connectionState;
  
  // Get reconnect attempts count
  reconnectAttempts = computed(() => this.wsService.getReconnectAttempts());

  /**
   * Manually trigger reconnection
   */
  reconnect(): void {
    console.log('🔄 Manual reconnection triggered by user');
    this.wsService.connect();
  }
}
