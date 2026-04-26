import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * EmptyStateComponent
 * 
 * Reusable component for displaying empty states with customizable message and icon.
 * Used when no data is available to display (e.g., no incidents match filters).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      <div class="empty-state-icon">{{ icon() }}</div>
      <h3 class="empty-state-title">{{ title() }}</h3>
      <p class="empty-state-message">{{ message() }}</p>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      min-height: 400px;
    }

    .empty-state-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      opacity: 0.6;
    }

    .empty-state-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 0.75rem 0;
    }

    .empty-state-message {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
      max-width: 400px;
      line-height: 1.5;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  /**
   * Icon to display (emoji or text)
   * Default: 📋
   */
  icon = input<string>('📋');

  /**
   * Title text
   * Default: "No hay datos"
   */
  title = input<string>('No hay datos');

  /**
   * Message text
   * Default: "No se encontraron resultados."
   */
  message = input<string>('No se encontraron resultados.');
}
