import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-rating-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onClose()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Califica el servicio recibido</h2>
          <p class="subtitle">Tu opinión nos ayuda a mejorar</p>
        </div>

        <div class="modal-body">
          <!-- Star Rating -->
          <div class="star-rating">
            @for (star of [1, 2, 3, 4, 5]; track star) {
              <button
                type="button"
                class="star-button"
                [class.selected]="star <= selectedRating()"
                (click)="selectRating(star)"
                [disabled]="isSubmitting()">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>
            }
          </div>

          @if (selectedRating() > 0) {
            <p class="rating-label">{{ getRatingLabel() }}</p>
          }

          <!-- Comment Field -->
          <div class="comment-field">
            <textarea
              [(ngModel)]="comment"
              placeholder="Cuéntanos sobre tu experiencia (opcional)"
              maxlength="500"
              rows="3"
              [disabled]="isSubmitting()">
            </textarea>
            <span class="char-count">{{ comment.length }}/500</span>
          </div>

          <!-- Error Message -->
          @if (errorMessage()) {
            <div class="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>{{ errorMessage() }}</span>
            </div>
          }
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn-secondary"
            (click)="onClose()"
            [disabled]="isSubmitting()">
            Ahora no
          </button>
          <button
            type="button"
            class="btn-primary"
            (click)="onSubmit()"
            [disabled]="isSubmitting() || selectedRating() === 0">
            @if (isSubmitting()) {
              <span class="spinner"></span>
              Enviando...
            } @else {
              Enviar calificación
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      padding: 24px 24px 16px;
      text-align: center;
    }

    .modal-header h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      color: #6b7280;
    }

    .modal-body {
      padding: 0 24px 24px;
    }

    .star-rating {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 24px 0 16px;
    }

    .star-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #d1d5db;
      transition: all 0.2s;
    }

    .star-button:hover:not(:disabled) {
      transform: scale(1.1);
    }

    .star-button.selected {
      color: #fbbf24;
    }

    .star-button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .rating-label {
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      margin: 0 0 16px;
    }

    .comment-field {
      position: relative;
    }

    .comment-field textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
    }

    .comment-field textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .comment-field textarea:disabled {
      background: #f3f4f6;
      cursor: not-allowed;
    }

    .char-count {
      position: absolute;
      bottom: 8px;
      right: 12px;
      font-size: 12px;
      color: #9ca3af;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      margin-top: 16px;
      color: #991b1b;
      font-size: 13px;
    }

    .error-message svg {
      flex-shrink: 0;
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
    }

    .btn-secondary,
    .btn-primary {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f9fafb;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-secondary:disabled,
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class RatingModalComponent {
  @Input() incidentId!: number;
  @Output() ratingSubmitted = new EventEmitter<{ rating: number; comment: string }>();
  @Output() closed = new EventEmitter<void>();

  selectedRating = signal(0);
  comment = '';
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  selectRating(rating: number): void {
    this.selectedRating.set(rating);
    this.errorMessage.set(null);
  }

  getRatingLabel(): string {
    const labels: Record<number, string> = {
      1: 'Muy malo',
      2: 'Malo',
      3: 'Regular',
      4: 'Bueno',
      5: 'Excelente'
    };
    return labels[this.selectedRating()] || '';
  }

  onSubmit(): void {
    if (this.selectedRating() === 0) {
      this.errorMessage.set('Por favor selecciona una calificación');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.ratingSubmitted.emit({
      rating: this.selectedRating(),
      comment: this.comment.trim()
    });
  }

  onClose(): void {
    if (!this.isSubmitting()) {
      this.closed.emit();
    }
  }
}
