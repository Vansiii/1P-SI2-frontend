import { Component, ChangeDetectionStrategy, input, computed, HostBinding, HostListener, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Incident, PriorityColors, StatusColors, IncidentPriority, IncidentStatus } from '../../../../../core/models/incident.model';
import { MemoizationService } from '../../../../../shared/services/memoization.service';
import { TooltipDirective } from '../../../../../shared/directives/tooltip.directive';

/**
 * IncidentCardComponent (Dumb Component)
 * 
 * Displays a single incident as a card with:
 * - Priority badge with color coding
 * - Status badge
 * - Timeout indicator when applicable
 * - Time remaining display
 * - Truncated description
 * - Metadata (category, location, date)
 * - Keyboard navigation (Enter/Space to select)
 * 
 * Requirements: 1.1, 1.5, 1.6, 1.7, 1.8, 1.9, 6.2, 6.3, 6.6, 6.11, 6.12, 12.3
 */
@Component({
  selector: 'app-incident-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './incident-card.component.html',
  styleUrl: './incident-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentCardComponent {
  // Services
  private memoizationService = inject(MemoizationService);

  // Input signal
  incident = input.required<Incident>();

  // Output signal for card click
  cardClick = output<number>();

  // Computed signals
  hasTimeout = computed(() => {
    const inc = this.incident();
    if (!inc.suggested_technician?.timeout_at) return false;
    return new Date(inc.suggested_technician.timeout_at) < new Date();
  });

  isHighPriority = computed(() => {
    return this.incident().prioridad === 'alta';
  });

  timeRemaining = computed(() => {
    const inc = this.incident();
    if (!inc.suggested_technician?.timeout_at) return null;
    
    // Use memoization for expensive time calculations
    const memoizedCalculateTime = this.memoizationService.memoize(
      `time-remaining-${inc.id}`,
      (timeoutAt: string) => {
        const timeoutDate = new Date(timeoutAt);
        const now = new Date();
        const diffMs = timeoutDate.getTime() - now.getTime();
        
        if (diffMs <= 0) return null;
        
        return Math.floor(diffMs / 60000); // Convert to minutes
      },
      { maxSize: 10, ttlMs: 5000 } // Cache for 5 seconds (time calculations need frequent updates)
    );

    return memoizedCalculateTime(inc.suggested_technician.timeout_at);
  });

  priorityClass = computed(() => {
    const priority = this.incident().prioridad;
    return `priority-${priority}`;
  });

  statusClass = computed(() => {
    const status = this.incident().estado;
    return `status-${status.replace(/_/g, '-')}`;
  });

  priorityColor = computed(() => {
    return PriorityColors[this.incident().prioridad];
  });

  statusColor = computed(() => {
    return StatusColors[this.incident().estado];
  });

  truncatedDescription = computed(() => {
    const desc = this.incident().descripcion;
    if (desc.length <= 100) return desc;
    return desc.substring(0, 100) + '...';
  });

  formattedDate = computed(() => {
    const inc = this.incident();
    
    // Use memoization for date formatting
    const memoizedFormatDate = this.memoizationService.memoize(
      `formatted-date-${inc.id}`,
      (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      },
      { maxSize: 50, ttlMs: 60000 } // Cache for 1 minute (date formatting is expensive but doesn't change often)
    );

    return memoizedFormatDate(inc.created_at);
  });

  categoryName = computed(() => {
    return this.incident().categoria?.nombre || 'Sin categoría';
  });

  locationText = computed(() => {
    return this.incident().ubicacion || 'Sin ubicación';
  });

  hasSuggestedTechnician = computed(() => {
    return this.incident().suggested_technician !== null;
  });

  // Tooltip texts
  priorityTooltip = computed(() => {
    const priority = this.incident().prioridad;
    const tooltips = {
      alta: 'Prioridad Alta - Requiere atención inmediata',
      media: 'Prioridad Media - Atención en horario normal',
      baja: 'Prioridad Baja - Puede esperar'
    };
    return tooltips[priority];
  });

  statusTooltip = computed(() => {
    const status = this.incident().estado;
    const tooltips = {
      pendiente: 'Pendiente - Esperando asignación de taller',
      asignado: 'Asignado - Taller asignado, esperando aceptación',
      aceptado: 'Aceptado - Taller confirmó la solicitud',
      en_camino: 'En Camino - Técnico se dirige al lugar',
      en_proceso: 'En Proceso - Técnico trabajando en el vehículo',
      resuelto: 'Resuelto - Servicio completado exitosamente',
      cancelado: 'Cancelado - Solicitud cancelada',
      sin_taller_disponible: 'Sin Taller - No hay talleres disponibles'
    };
    return tooltips[status];
  });

  timeoutTooltip = computed(() => {
    const remaining = this.timeRemaining();
    if (remaining === null) {
      return 'Tiempo agotado - El taller no respondió a tiempo';
    }
    return `Tiempo restante: ${remaining} minutos para responder`;
  });

  noTechnicianTooltip = computed(() => {
    return 'Sin técnico asignado - Esperando asignación automática';
  });

  // Host bindings for CSS classes and accessibility
  @HostBinding('class.has-timeout')
  get hasTimeoutClass() {
    return this.hasTimeout();
  }

  @HostBinding('class.high-priority')
  get highPriorityClass() {
    return this.isHighPriority();
  }

  @HostBinding('attr.role')
  get role() {
    return 'button';
  }

  @HostBinding('attr.tabindex')
  get tabindex() {
    return 0;
  }

  @HostBinding('attr.aria-label')
  get ariaLabel() {
    return `Solicitud ${this.incident().id}, ${this.incident().prioridad} prioridad, ${this.incident().estado}`;
  }

  /**
   * Handle Enter or Space key to select card
   */
  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  handleKeyboardSelect(event: Event): void {
    event.preventDefault();
    this.cardClick.emit(this.incident().id);
  }

  /**
   * Handle click event
   */
  @HostListener('click')
  handleClick(): void {
    this.cardClick.emit(this.incident().id);
  }
}
