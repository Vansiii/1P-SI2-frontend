import { Injectable, signal } from '@angular/core';

/**
 * Toast types for different notification styles
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast notification interface
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

/**
 * ToastService
 * 
 * Service for displaying toast notifications throughout the application.
 * Supports success, error, info, and warning toast types.
 * Auto-dismisses after specified duration (default 3 seconds).
 * 
 * Usage:
 * ```typescript
 * constructor(private toastService: ToastService) {}
 * 
 * this.toastService.success('Operation completed successfully');
 * this.toastService.error('An error occurred');
 * this.toastService.info('Information message');
 * this.toastService.warning('Warning message');
 * ```
 * 
 * Requirements: 9.4, 10.12, 10.13
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  /**
   * Signal containing all active toasts
   */
  toasts = signal<Toast[]>([]);

  /**
   * Default duration for toasts (milliseconds)
   */
  private readonly DEFAULT_DURATION = 3000;

  /**
   * Show a success toast
   */
  success(message: string, duration: number = this.DEFAULT_DURATION): void {
    this.show('success', message, duration);
  }

  /**
   * Show an error toast
   */
  error(message: string, duration: number = this.DEFAULT_DURATION): void {
    this.show('error', message, duration);
  }

  /**
   * Show an info toast
   */
  info(message: string, duration: number = this.DEFAULT_DURATION): void {
    this.show('info', message, duration);
  }

  /**
   * Show a warning toast
   */
  warning(message: string, duration: number = this.DEFAULT_DURATION): void {
    this.show('warning', message, duration);
  }

  /**
   * Show a toast notification
   */
  private show(type: ToastType, message: string, duration: number): void {
    const id = this.generateId();
    const toast: Toast = { id, type, message, duration };

    // Add toast to the list
    this.toasts.update(toasts => [...toasts, toast]);

    // Auto-dismiss after duration
    setTimeout(() => {
      this.dismiss(id);
    }, duration);
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: string): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toasts.set([]);
  }

  /**
   * Generate a unique ID for a toast
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
