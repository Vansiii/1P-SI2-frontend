import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Incident } from '../../../../../core/models/incident.model';
import { IncidentCardComponent } from '../incident-card/incident-card.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

/**
 * IncidentsGridComponent (Dumb Component)
 * 
 * Displays a responsive grid of incident cards.
 * Handles card selection and provides empty state when no incidents.
 * Uses virtual scrolling for performance when > 50 incidents.
 * 
 * Features:
 * - Responsive CSS Grid layout (3/2/1 columns based on screen size)
 * - Virtual scrolling for large datasets (> 50 incidents)
 * - Performance optimized with trackBy function
 * - Empty state display
 * - Click event delegation to parent
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.10, 8.2, 11.1, 11.2, 11.3
 */
@Component({
  selector: 'app-incidents-grid',
  standalone: true,
  imports: [CommonModule, ScrollingModule, IncidentCardComponent, EmptyStateComponent],
  templateUrl: './incidents-grid.component.html',
  styleUrl: './incidents-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentsGridComponent {
  // Input signal
  incidents = input.required<Incident[]>();

  // Output signal
  incidentSelect = output<number>();

  /**
   * Threshold for enabling virtual scrolling
   */
  private readonly VIRTUAL_SCROLL_THRESHOLD = 50;

  /**
   * Item size for virtual scrolling (approximate height of incident card)
   */
  readonly itemSize = 220;

  /**
   * Buffer size for virtual scrolling (number of items to render outside viewport)
   */
  readonly bufferSize = 5;

  /**
   * Computed signal to determine if virtual scrolling should be used
   */
  useVirtualScroll = computed(() => this.incidents().length > this.VIRTUAL_SCROLL_THRESHOLD);

  /**
   * Handle card click event
   * Emits the incident ID to parent component
   */
  onCardClick(incidentId: number): void {
    this.incidentSelect.emit(incidentId);
  }

  /**
   * TrackBy function for performance optimization
   * Helps Angular track items in the list efficiently
   */
  trackByIncidentId(index: number, incident: Incident): number {
    return incident.id;
  }
}
