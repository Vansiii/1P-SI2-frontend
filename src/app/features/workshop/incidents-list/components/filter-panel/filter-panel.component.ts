import { Component, ChangeDetectionStrategy, input, output, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { IncidentFilter } from '../../../../../core/models/incident.model';
import { DebounceService } from '../../../../../shared/services/debounce.service';
import { TooltipDirective } from '../../../../../shared/directives/tooltip.directive';

/**
 * Filter counts for each filter option
 */
export interface FilterCounts {
  todos: number;
  pendientes: number;
  asignadas: number;
  en_proceso: number;
  resueltas: number;
}

/**
 * Filter Panel Component (Dumb Component)
 * 
 * Displays filter buttons with count badges for incident list filtering.
 * Emits filter changes to parent component with debouncing to prevent
 * excessive filter operations.
 * 
 * Features:
 * - Debounced filter changes (300ms delay)
 * - Active filter highlighting
 * - Count badges for each filter
 * - Accessible button interactions
 * 
 * Requirements: 3.1, 3.2, 3.8, 3.9, 8.2, 8.3, 8.4, 11.5
 */
@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterPanelComponent implements OnInit, OnDestroy {
  // Services
  private debounceService = inject(DebounceService);

  // Input signals
  counts = input.required<FilterCounts>();
  activeFilter = input.required<IncidentFilter>();

  // Output
  filterChange = output<IncidentFilter>();

  // Debounce configuration
  private readonly DEBOUNCE_KEY = 'filter-panel-changes';
  private readonly DEBOUNCE_DELAY = 300; // ms

  ngOnInit(): void {
    // Set up debounced filter changes
    const { input$, output$ } = this.debounceService.createDebouncedObservable<IncidentFilter>(
      this.DEBOUNCE_KEY,
      this.DEBOUNCE_DELAY
    );

    // Subscribe to debounced output and emit to parent
    output$.pipe(
      takeUntilDestroyed()
    ).subscribe(filter => {
      this.filterChange.emit(filter);
    });
  }

  ngOnDestroy(): void {
    // Clean up debounce stream
    this.debounceService.cleanup(this.DEBOUNCE_KEY);
  }

  /**
   * Check if a filter is currently active
   */
  isActive = computed(() => {
    const active = this.activeFilter();
    return (filter: IncidentFilter) => active === filter;
  });

  /**
   * Select a filter and emit change event with debouncing
   */
  selectFilter(filter: IncidentFilter): void {
    // Emit to debounced stream instead of directly to parent
    this.debounceService.emit(this.DEBOUNCE_KEY, filter);
  }

  /**
   * Get filter label for display
   */
  getFilterLabel(filter: IncidentFilter): string {
    const labels: Record<IncidentFilter, string> = {
      todos: 'Todos',
      pendientes: 'Pendientes',
      asignadas: 'Asignadas',
      en_proceso: 'En Proceso',
      resueltas: 'Resueltas'
    };
    return labels[filter];
  }

  /**
   * Get count for a specific filter
   */
  getCount(filter: IncidentFilter): number {
    return this.counts()[filter];
  }

  /**
   * Get tooltip text for filter buttons
   */
  getFilterTooltip(filter: IncidentFilter): string {
    const tooltips: Record<IncidentFilter, string> = {
      todos: 'Mostrar todas las solicitudes sin filtrar',
      pendientes: 'Solicitudes esperando asignación de taller',
      asignadas: 'Solicitudes asignadas a talleres, esperando aceptación',
      en_proceso: 'Solicitudes aceptadas y en proceso de atención',
      resueltas: 'Solicitudes completadas exitosamente'
    };
    return tooltips[filter];
  }
}
