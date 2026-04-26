import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { 
  Incident, 
  IncidentFilter, 
  FilterCounts, 
  IncidentStatus,
  IncidentUpdate
} from '../models/incident.model';
import { MemoizationService } from '../../shared/services/memoization.service';

/**
 * IncidentsStateService
 * 
 * Single source of truth for incident state management using Angular Signals.
 * Provides reactive state updates, computed values, and immutable update patterns.
 */
@Injectable({
  providedIn: 'root'
})
export class IncidentsStateService {
  // Services
  private memoizationService = inject(MemoizationService);
  // ============================================
  // WRITABLE SIGNALS (Mutable State)
  // ============================================

  /**
   * All incidents loaded from API
   */
  public incidents = signal<Incident[]>([]);

  /**
   * Loading state for initial load
   */
  public loading = signal<boolean>(false);

  /**
   * Error state
   */
  public error = signal<string | null>(null);

  /**
   * Currently selected incident ID
   */
  public selectedIncidentId = signal<number | null>(null);

  /**
   * Active filter
   */
  public activeFilter = signal<IncidentFilter>('todos');

  // ============================================
  // COMPUTED SIGNALS (Derived State)
  // ============================================

  /**
   * Filtered incidents based on active filter
   */
  public filteredIncidents = computed(() => {
    const incidents = this.incidents();
    const filter = this.activeFilter();

    switch (filter) {
      case 'todos':
        return incidents;
      
      case 'pendientes':
        return incidents.filter(i => i.estado === 'pendiente');
      
      case 'asignadas':
        return incidents.filter(i => i.estado === 'asignado');
      
      case 'en_proceso':
        return incidents.filter(i => 
          ['aceptado', 'en_camino', 'en_proceso'].includes(i.estado)
        );
      
      case 'resueltas':
        return incidents.filter(i => i.estado === 'resuelto');
      
      default:
        return incidents;
    }
  });

  /**
   * Count of incidents for each filter (memoized for performance)
   */
  public filterCounts = computed((): FilterCounts => {
    const incidents = this.incidents();

    // Use memoization for expensive filter counting
    return this.memoizationService.memoizeArrayComputation(
      'filter-counts',
      incidents,
      (incidents: Incident[]) => ({
        todos: incidents.length,
        pendientes: incidents.filter(i => i.estado === 'pendiente').length,
        asignadas: incidents.filter(i => i.estado === 'asignado').length,
        en_proceso: incidents.filter(i => 
          ['aceptado', 'en_camino', 'en_proceso'].includes(i.estado)
        ).length,
        resueltas: incidents.filter(i => i.estado === 'resuelto').length
      }),
      { maxSize: 50, ttlMs: 30000 } // Cache for 30 seconds
    );
  });

  /**
   * Currently selected incident
   */
  public selectedIncident = computed(() => {
    const id = this.selectedIncidentId();
    if (id === null) return null;
    
    return this.incidents().find(i => i.id === id) || null;
  });

  /**
   * Check if there are any incidents
   */
  public hasIncidents = computed(() => {
    return this.incidents().length > 0;
  });

  /**
   * Incidents with active timeout (memoized for performance)
   */
  public incidentsWithTimeout = computed(() => {
    const incidents = this.incidents();
    const now = new Date();

    // Use memoization for expensive timeout calculations
    return this.memoizationService.memoizeArrayComputation(
      'incidents-with-timeout',
      incidents,
      (incidents: Incident[]) => {
        const currentTime = new Date();
        return incidents.filter(incident => {
          if (!incident.suggested_technician?.timeout_at) return false;
          return new Date(incident.suggested_technician.timeout_at) < currentTime;
        });
      },
      { maxSize: 20, ttlMs: 10000 } // Cache for 10 seconds (timeout checks need frequent updates)
    );
  });

  /**
   * Incidents sorted by priority and timeout (memoized for performance)
   */
  public sortedIncidents = computed(() => {
    const incidents = this.filteredIncidents();
    
    // Use memoization for expensive sorting operations
    return this.memoizationService.memoizeArrayComputation(
      'sorted-incidents',
      incidents,
      (incidents: Incident[]) => {
        return [...incidents].sort((a, b) => {
          // First, sort by timeout (timeout incidents first)
          const aHasTimeout = this.hasTimeout(a);
          const bHasTimeout = this.hasTimeout(b);
          
          if (aHasTimeout && !bHasTimeout) return -1;
          if (!aHasTimeout && bHasTimeout) return 1;
          
          // Then, sort by priority
          const priorityOrder = { alta: 0, media: 1, baja: 2 };
          const aPriority = priorityOrder[a.prioridad];
          const bPriority = priorityOrder[b.prioridad];
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          
          // Finally, sort by creation date (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      },
      { maxSize: 30, ttlMs: 15000 } // Cache for 15 seconds
    );
  });

  // ============================================
  // EFFECTS (Side Effects)
  // ============================================

  constructor() {
    // Log state changes in development
    if (!environment.production) {
      effect(() => {
        console.log('[IncidentsState] State changed:', {
          count: this.incidents().length,
          filter: this.activeFilter(),
          filteredCount: this.filteredIncidents().length
        });
      });
    }

    // Persist active filter to sessionStorage
    effect(() => {
      const filter = this.activeFilter();
      sessionStorage.setItem('incidents_filter', filter);
    });

    // Load persisted filter on init
    this.loadPersistedFilter();
  }

  // ============================================
  // PUBLIC METHODS (Actions)
  // ============================================

  /**
   * Set all incidents (typically from initial load)
   */
  public setIncidents(incidents: Incident[]): void {
    this.incidents.set(incidents);
    this.error.set(null);
  }

  /**
   * Add a new incident to the list
   */
  public addIncident(incident: Incident): void {
    const current = this.incidents();
    
    // Check if incident already exists
    if (current.some(i => i.id === incident.id)) {
      console.warn('[IncidentsState] Incident already exists:', incident.id);
      return;
    }
    
    this.incidents.set([...current, incident]);
  }

  /**
   * Update an existing incident
   */
  public updateIncident(id: number, changes: IncidentUpdate): void {
    const current = this.incidents();
    const index = current.findIndex(i => i.id === id);
    
    if (index === -1) {
      console.warn('[IncidentsState] Incident not found for update:', id);
      return;
    }
    
    const updated = [...current];
    updated[index] = {
      ...updated[index],
      ...changes,
      updated_at: new Date().toISOString()
    };
    
    this.incidents.set(updated);
  }

  /**
   * Remove an incident from the list
   */
  public removeIncident(id: number): void {
    const current = this.incidents();
    const filtered = current.filter(i => i.id !== id);
    
    if (filtered.length === current.length) {
      console.warn('[IncidentsState] Incident not found for removal:', id);
      return;
    }
    
    this.incidents.set(filtered);
    
    // Clear selection if removed incident was selected
    if (this.selectedIncidentId() === id) {
      this.selectedIncidentId.set(null);
    }
  }

  /**
   * Set active filter
   */
  public setFilter(filter: IncidentFilter): void {
    this.activeFilter.set(filter);
  }

  /**
   * Select an incident
   */
  public selectIncident(id: number | null): void {
    this.selectedIncidentId.set(id);
  }

  /**
   * Clear all incidents
   */
  public clearIncidents(): void {
    this.incidents.set([]);
    this.selectedIncidentId.set(null);
  }

  /**
   * Verify timeouts for all incidents
   */
  public verifyTimeouts(): void {
    const now = new Date();
    const current = this.incidents();
    let hasChanges = false;
    
    const updated = current.map(incident => {
      if (this.shouldCheckTimeout(incident)) {
        const hasTimeout = this.checkTimeout(incident, now);
        
        if (hasTimeout && !incident.has_timeout) {
          hasChanges = true;
          return { ...incident, has_timeout: true };
        }
      }
      
      return incident;
    });
    
    if (hasChanges) {
      this.incidents.set(updated);
    }
  }

  // ============================================
  // QUERY METHODS (Read-only)
  // ============================================

  /**
   * Get incident by ID
   */
  public getIncidentById(id: number): Incident | undefined {
    return this.incidents().find(i => i.id === id);
  }

  /**
   * Get incidents by status
   */
  public getIncidentsByStatus(status: IncidentStatus): Incident[] {
    return this.incidents().filter(i => i.estado === status);
  }

  /**
   * Get incidents with timeout
   */
  public getIncidentsWithTimeout(): Incident[] {
    return this.incidentsWithTimeout();
  }

  /**
   * Get count for specific filter
   */
  public getCountForFilter(filter: IncidentFilter): number {
    const counts = this.filterCounts();
    return counts[filter];
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Check if incident should be checked for timeout
   */
  private shouldCheckTimeout(incident: Incident): boolean {
    return (
      incident.estado === 'asignado' &&
      incident.suggested_technician !== null &&
      incident.suggested_technician !== undefined &&
      incident.suggested_technician.timeout_at !== null
    );
  }

  /**
   * Check if incident has timed out
   */
  private checkTimeout(incident: Incident, now: Date): boolean {
    if (!incident.suggested_technician?.timeout_at) {
      return false;
    }

    const timeoutDate = new Date(incident.suggested_technician.timeout_at);
    return now >= timeoutDate;
  }

  /**
   * Check if incident has timeout
   */
  private hasTimeout(incident: Incident): boolean {
    if (!incident.suggested_technician?.timeout_at) return false;
    return new Date(incident.suggested_technician.timeout_at) < new Date();
  }

  /**
   * Load persisted filter from sessionStorage
   */
  private loadPersistedFilter(): void {
    const persisted = sessionStorage.getItem('incidents_filter');
    if (persisted && this.isValidFilter(persisted)) {
      this.activeFilter.set(persisted as IncidentFilter);
    }
  }

  /**
   * Validate filter value
   */
  private isValidFilter(value: string): boolean {
    return ['todos', 'pendientes', 'asignadas', 'en_proceso', 'resueltas'].includes(value);
  }
}
