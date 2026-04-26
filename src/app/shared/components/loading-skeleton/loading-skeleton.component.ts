import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * LoadingSkeletonComponent
 * 
 * Displays animated skeleton placeholders for incident cards during loading.
 * Matches the structure of IncidentCardComponent for seamless transition.
 */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-grid">
      @for (item of skeletonArray(); track $index) {
        <div class="skeleton-card">
          <!-- Header -->
          <div class="skeleton-header">
            <div class="skeleton-id"></div>
            <div class="skeleton-badge"></div>
          </div>
          
          <!-- Body -->
          <div class="skeleton-body">
            <div class="skeleton-line skeleton-line-full"></div>
            <div class="skeleton-line skeleton-line-medium"></div>
            <div class="skeleton-line skeleton-line-short"></div>
          </div>
          
          <!-- Footer -->
          <div class="skeleton-footer">
            <div class="skeleton-badge-small"></div>
            <div class="skeleton-badge-small"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
      padding: 1rem;
    }

    @media (min-width: 1400px) {
      .skeleton-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (min-width: 1024px) and (max-width: 1399px) {
      .skeleton-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 1023px) {
      .skeleton-grid {
        grid-template-columns: 1fr;
      }
    }

    .skeleton-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    .skeleton-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .skeleton-id {
      width: 80px;
      height: 20px;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-badge {
      width: 60px;
      height: 24px;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 12px;
    }

    .skeleton-badge-small {
      width: 80px;
      height: 20px;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 10px;
    }

    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    .skeleton-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .skeleton-line {
      height: 16px;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-line-full {
      width: 100%;
    }

    .skeleton-line-medium {
      width: 75%;
    }

    .skeleton-line-short {
      width: 50%;
    }

    .skeleton-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.5rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSkeletonComponent {
  /**
   * Number of skeleton cards to display
   * Default: 6 (2 rows of 3 cards on desktop)
   */
  count = input<number>(6);

  /**
   * Array for *ngFor iteration
   */
  protected skeletonArray = () => Array(this.count()).fill(0);
}
