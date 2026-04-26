import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

/**
 * ToastContainerComponent
 * 
 * Container component that displays toast notifications in the top-right corner.
 * Automatically manages toast lifecycle and animations.
 * 
 * This component should be added to the root app component template:
 * ```html
 * <app-toast-container />
 * ```
 * 
 * Requirements: 9.4, 10.12, 10.13
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="toast toast-{{ toast.type }}"
          (click)="toastService.dismiss(toast.id)"
        >
          <div class="toast-icon">
            @switch (toast.type) {
              @case ('success') { ✓ }
              @case ('error') { ✕ }
              @case ('info') { ℹ }
              @case ('warning') { ⚠ }
            }
          </div>
          <div class="toast-message">{{ toast.message }}</div>
          <button 
            class="toast-close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      background: white;
      border-left: 4px solid;
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    }

    .toast:hover {
      transform: translateX(-4px);
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: bold;
      border-radius: 50%;
    }

    .toast-message {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
      color: #374151;
    }

    .toast-close {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      font-size: 16px;
      padding: 0;
      transition: color 0.2s;
    }

    .toast-close:hover {
      color: #374151;
    }

    /* Success Toast */
    .toast-success {
      border-left-color: #10b981;
    }

    .toast-success .toast-icon {
      color: #10b981;
      background: #d1fae5;
    }

    /* Error Toast */
    .toast-error {
      border-left-color: #ef4444;
    }

    .toast-error .toast-icon {
      color: #ef4444;
      background: #fee2e2;
    }

    /* Info Toast */
    .toast-info {
      border-left-color: #3b82f6;
    }

    .toast-info .toast-icon {
      color: #3b82f6;
      background: #dbeafe;
    }

    /* Warning Toast */
    .toast-warning {
      border-left-color: #f59e0b;
    }

    .toast-warning .toast-icon {
      color: #f59e0b;
      background: #fef3c7;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }

      .toast {
        padding: 12px;
      }

      .toast-message {
        font-size: 13px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastContainerComponent {
  protected toastService = inject(ToastService);
}
