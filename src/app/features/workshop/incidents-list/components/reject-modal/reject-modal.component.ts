import { Component, ChangeDetectionStrategy, input, output, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerComponent } from '../../../../../shared/components/spinner/spinner.component';

/**
 * RejectModalComponent
 * 
 * Modal for rejecting an incident with a reason.
 * 
 * Features:
 * - Textarea for rejection reason
 * - Character count (10-200 characters)
 * - Validation with error messages
 * - Disabled confirm button when invalid
 * - Keyboard navigation (Escape to close, Enter to confirm)
 * 
 * Requirements: 10.8, 10.9, 10.10, 10.13, 12.2, 12.3
 */
@Component({
  selector: 'app-reject-modal',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  templateUrl: './reject-modal.component.html',
  styleUrl: './reject-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'reject-modal-title'
  }
})
export class RejectModalComponent {
  // Input signals
  loading = input<boolean>(false);

  // Output signals
  reject = output<string>();
  cancel = output<void>();

  // Local signals
  reason = signal<string>('');
  reasonError = signal<string | null>(null);

  // Computed signal for validation
  isValid = computed(() => {
    return this.validateReason() === null;
  });

  /**
   * Validate rejection reason
   * Returns error message or null if valid
   */
  validateReason(): string | null {
    const trimmedReason = this.reason().trim();

    if (trimmedReason.length === 0) {
      return 'El motivo es requerido';
    }

    if (trimmedReason.length < 10) {
      return 'Mínimo 10 caracteres';
    }

    if (trimmedReason.length > 200) {
      return 'Máximo 200 caracteres';
    }

    return null;
  }

  /**
   * Handle reason input change
   */
  onReasonChange(value: string): void {
    this.reason.set(value);
    
    // Clear error when user starts typing
    if (this.reasonError()) {
      this.reasonError.set(null);
    }
  }

  /**
   * Confirm rejection
   */
  confirmReject(): void {
    const error = this.validateReason();

    if (error) {
      this.reasonError.set(error);
      return;
    }

    // Emit rejection with reason
    this.reject.emit(this.reason().trim());

    // Clear form
    this.reason.set('');
    this.reasonError.set(null);
  }

  /**
   * Cancel and close modal
   */
  onCancel(): void {
    this.cancel.emit();
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    return this.reason().length;
  }

  /**
   * Check if character limit is exceeded
   */
  isCharacterLimitExceeded(): boolean {
    return this.reason().length > 200;
  }

  /**
   * Check if character count is close to limit
   */
  isCharacterCountWarning(): boolean {
    const count = this.reason().length;
    return count > 180 && count <= 200;
  }

  /**
   * Handle Escape key to close modal
   */
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    this.onCancel();
  }

  /**
   * Handle Ctrl+Enter or Cmd+Enter to confirm (if valid)
   */
  @HostListener('document:keydown.control.enter')
  @HostListener('document:keydown.meta.enter')
  handleCtrlEnterKey(): void {
    if (this.isValid()) {
      this.confirmReject();
    }
  }
}
