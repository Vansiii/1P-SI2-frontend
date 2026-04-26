import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * SpinnerComponent
 * 
 * Reusable loading spinner component with customizable size.
 * Used for button loading states and inline loading indicators.
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="spinner" [class]="'spinner-' + size()"></div>
  `,
  styles: [`
    .spinner {
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }

    .spinner-small {
      width: 14px;
      height: 14px;
      border-width: 2px;
    }

    .spinner-medium {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }

    .spinner-large {
      width: 32px;
      height: 32px;
      border-width: 3px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpinnerComponent {
  /**
   * Size of the spinner
   * Default: 'small'
   */
  size = input<'small' | 'medium' | 'large'>('small');
}
