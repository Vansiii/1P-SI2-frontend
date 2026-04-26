import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div 
        class="alert"
        [class.alert-success]="type === 'success'"
        [class.alert-error]="type === 'error'"
        [class.alert-warning]="type === 'warning'"
        [class.alert-info]="type === 'info'"
        role="alert"
      >
        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          @if (type === 'success') {
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          }
          @if (type === 'error') {
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4m0 4h.01"/>
          }
          @if (type === 'warning') {
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          }
          @if (type === 'info') {
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4m0-4h.01"/>
          }
        </svg>
        
        <div class="alert-content">
          @if (title) {
            <p class="alert-title">{{ title }}</p>
          }
          <p class="alert-message">{{ message }}</p>
        </div>
        
        @if (dismissible) {
          <button class="alert-close" (click)="onClose.emit()" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .alert-success {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 2px solid #86efac;
      color: #166534;
    }

    .alert-error {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border: 2px solid #fecaca;
      color: #991b1b;
    }

    .alert-warning {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 2px solid #fde68a;
      color: #92400e;
    }

    .alert-info {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 2px solid #bfdbfe;
      color: #1e40af;
    }

    .alert-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
    }

    .alert-success .alert-icon {
      color: #16a34a;
    }

    .alert-error .alert-icon {
      color: #dc2626;
    }

    .alert-warning .alert-icon {
      color: #f59e0b;
    }

    .alert-info .alert-icon {
      color: #3b82f6;
    }

    .alert-content {
      flex: 1;
      min-width: 0;
    }

    .alert-title {
      font-weight: 700;
      font-size: 0.9375rem;
      margin: 0 0 0.25rem 0;
      line-height: 1.4;
    }

    .alert-message {
      font-size: 0.875rem;
      margin: 0;
      line-height: 1.5;
      font-weight: 500;
    }

    .alert-close {
      flex-shrink: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
      opacity: 0.6;
      color: currentColor;
    }

    .alert-close:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.1);
    }

    .alert-close svg {
      width: 20px;
      height: 20px;
    }

    @media (max-width: 640px) {
      .alert {
        padding: 0.875rem 1rem;
        gap: 0.625rem;
      }

      .alert-icon {
        width: 20px;
        height: 20px;
      }

      .alert-title {
        font-size: 0.875rem;
      }

      .alert-message {
        font-size: 0.8125rem;
      }
    }
  `]
})
export class AlertComponent {
  @Input() message = '';
  @Input() title?: string;
  @Input() type: AlertType = 'info';
  @Input() dismissible = true;
  @Input() visible = true;
  @Output() onClose = new EventEmitter<void>();
}
