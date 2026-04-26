import { Component, ChangeDetectionStrategy, input, output, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Incident, AIAnalysis } from '../../../../../core/models/incident.model';
import { SpinnerComponent } from '../../../../../shared/components/spinner/spinner.component';

/**
 * Accept data structure for incident acceptance
 */
export interface AcceptData {
  technicianId: number | null;
  acceptWithSuggested: boolean;
}

/**
 * AcceptModalComponent
 * 
 * Modal for accepting an incident with options:
 * - Accept with suggested technician (from AI)
 * - Assign technician manually
 * 
 * Features:
 * - Display AI recommendation
 * - Show suggested technician details
 * - Option selection
 * - Validation before confirmation
 * - Keyboard navigation (Escape to close, Enter to confirm)
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.12, 12.2, 12.3
 */
@Component({
  selector: 'app-accept-modal',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  templateUrl: './accept-modal.component.html',
  styleUrl: './accept-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'accept-modal-title'
  }
})
export class AcceptModalComponent {
  // Input signals
  incident = input.required<Incident>();
  aiAnalysis = input<AIAnalysis | null>(null);
  loading = input<boolean>(false);

  // Output signals
  accept = output<AcceptData>();
  cancel = output<void>();

  // Local signals
  selectedOption = signal<'suggested' | 'manual' | null>(null);

  /**
   * Select an option (suggested or manual)
   */
  selectOption(option: 'suggested' | 'manual'): void {
    this.selectedOption.set(option);
  }

  /**
   * Confirm acceptance with selected option
   */
  confirmAccept(): void {
    const option = this.selectedOption();
    
    if (!option) {
      return;
    }

    if (option === 'suggested') {
      const technicianId = this.incident().suggested_technician?.technician_id || null;
      this.accept.emit({
        technicianId,
        acceptWithSuggested: true
      });
    } else {
      // Manual assignment
      this.accept.emit({
        technicianId: null,
        acceptWithSuggested: false
      });
    }
  }

  /**
   * Cancel and close modal
   */
  onCancel(): void {
    this.cancel.emit();
  }

  /**
   * Check if option is selected
   */
  isSelected(option: 'suggested' | 'manual'): boolean {
    return this.selectedOption() === option;
  }

  /**
   * Check if confirm button should be disabled
   */
  isConfirmDisabled(): boolean {
    return this.selectedOption() === null;
  }

  /**
   * Check if suggested technician option is available
   */
  hasSuggestedTechnician(): boolean {
    return this.incident().suggested_technician !== null;
  }

  /**
   * Handle Escape key to close modal
   */
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    this.onCancel();
  }

  /**
   * Handle Enter key to confirm (if option selected)
   */
  @HostListener('document:keydown.enter')
  handleEnterKey(): void {
    if (!this.isConfirmDisabled()) {
      this.confirmAccept();
    }
  }
}
