import { TestBed } from '@angular/core/testing';
import { IncidentsStateService, Incident, IncidentFilter } from './incidents-state.service';

describe('IncidentsStateService', () => {
  let service: IncidentsStateService;

  // Helper function to create mock incidents
  const createMockIncident = (overrides: Partial<Incident> = {}): Incident => ({
    id: 1,
    cliente_id: 1,
    vehiculo_id: 1,
    taller_id: null,
    tecnico_id: null,
    estado: 'pendiente',
    descripcion: 'Test incident',
    latitud: 0,
    longitud: 0,
    direccion_referencia: null,
    categoria_ia: 'mecanica',
    prioridad: 'media',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IncidentsStateService]
    });
    service = TestBed.inject(IncidentsStateService);
    
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setIncidents', () => {
    it('should set incidents', () => {
      const incidents = [createMockIncident()];
      service.setIncidents(incidents);
      
      expect(service.incidents()).toEqual(incidents);
    });

    it('should clear error when setting incidents', () => {
      service.error.set('Test error');
      service.setIncidents([createMockIncident()]);
      
      expect(service.error()).toBeNull();
    });
  });

  describe('addIncident', () => {
    it('should add incident', () => {
      const incident = createMockIncident();
      service.addIncident(incident);
      
      expect(service.incidents()).toContain(incident);
    });

    it('should not add duplicate incident', () => {
      const incident = createMockIncident();
      service.addIncident(incident);
      service.addIncident(incident);
      
      expect(service.incidents().length).toBe(1);
    });
  });

  describe('updateIncident', () => {
    it('should update incident', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      
      service.updateIncident(incident.id, { estado: 'asignado' });
      
      const updated = service.getIncidentById(incident.id);
      expect(updated?.estado).toBe('asignado');
    });

    it('should not mutate original incident', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      
      const originalIncident = service.incidents()[0];
      service.updateIncident(incident.id, { estado: 'asignado' });
      
      expect(originalIncident).not.toBe(service.incidents()[0]);
    });

    it('should warn when incident not found', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      service.updateIncident(999, { estado: 'asignado' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[IncidentsState] Incident not found for update:',
        999
      );
    });
  });

  describe('removeIncident', () => {
    it('should remove incident', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      
      service.removeIncident(incident.id);
      
      expect(service.incidents().length).toBe(0);
    });

    it('should clear selection if removed incident was selected', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      service.selectIncident(incident.id);
      
      service.removeIncident(incident.id);
      
      expect(service.selectedIncidentId()).toBeNull();
    });

    it('should warn when incident not found', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      service.removeIncident(999);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[IncidentsState] Incident not found for removal:',
        999
      );
    });
  });

  describe('setFilter', () => {
    it('should set active filter', () => {
      service.setFilter('pending');
      
      expect(service.activeFilter()).toBe('pending');
    });

    it('should persist filter to sessionStorage', async () => {
      service.setFilter('assigned');
      
      // Wait for effect to run
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(sessionStorage.getItem('incidents_filter')).toBe('assigned');
    });
  });

  describe('filteredIncidents', () => {
    beforeEach(() => {
      const incidents = [
        createMockIncident({ id: 1, estado: 'pendiente' }),
        createMockIncident({ id: 2, estado: 'asignado' }),
        createMockIncident({ id: 3, estado: 'en_proceso' }),
        createMockIncident({ id: 4, estado: 'resuelto' })
      ];
      service.setIncidents(incidents);
    });

    it('should filter by pending', () => {
      service.setFilter('pending');
      
      expect(service.filteredIncidents().length).toBe(1);
      expect(service.filteredIncidents()[0].estado).toBe('pendiente');
    });

    it('should filter by assigned', () => {
      service.setFilter('assigned');
      
      expect(service.filteredIncidents().length).toBe(1);
      expect(service.filteredIncidents()[0].estado).toBe('asignado');
    });

    it('should filter by in_progress', () => {
      service.setFilter('in_progress');
      
      expect(service.filteredIncidents().length).toBe(1);
      expect(service.filteredIncidents()[0].estado).toBe('en_proceso');
    });

    it('should filter by resolved', () => {
      service.setFilter('resolved');
      
      expect(service.filteredIncidents().length).toBe(1);
      expect(service.filteredIncidents()[0].estado).toBe('resuelto');
    });

    it('should show all when filter is all', () => {
      service.setFilter('all');
      
      expect(service.filteredIncidents().length).toBe(4);
    });
  });

  describe('filterCounts', () => {
    it('should calculate filter counts', () => {
      const incidents = [
        createMockIncident({ id: 1, estado: 'pendiente' }),
        createMockIncident({ id: 2, estado: 'asignado' }),
        createMockIncident({ id: 3, estado: 'en_proceso' }),
        createMockIncident({ id: 4, estado: 'pendiente' })
      ];
      service.setIncidents(incidents);
      
      const counts = service.filterCounts();
      
      expect(counts.all).toBe(4);
      expect(counts.pending).toBe(2);
      expect(counts.assigned).toBe(1);
      expect(counts.in_progress).toBe(1);
      expect(counts.resolved).toBe(0);
    });
  });

  describe('selectedIncident', () => {
    it('should return selected incident', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      service.selectIncident(incident.id);
      
      expect(service.selectedIncident()).toEqual(incident);
    });

    it('should return null when no incident selected', () => {
      expect(service.selectedIncident()).toBeNull();
    });

    it('should return null when selected incident not found', () => {
      service.selectIncident(999);
      
      expect(service.selectedIncident()).toBeNull();
    });
  });

  describe('hasIncidents', () => {
    it('should return true when incidents exist', () => {
      service.setIncidents([createMockIncident()]);
      
      expect(service.hasIncidents()).toBe(true);
    });

    it('should return false when no incidents', () => {
      expect(service.hasIncidents()).toBe(false);
    });
  });

  describe('verifyTimeouts', () => {
    it('should update has_timeout flag when timeout expired', () => {
      const pastTimeout = new Date(Date.now() - 60000).toISOString();
      const incident = createMockIncident({
        estado: 'asignado',
        suggested_technician: {
          technician_id: 1,
          technician_name: 'Test',
          distance_km: 1,
          compatibility_score: 80,
          timeout_at: pastTimeout,
          assigned_at: new Date().toISOString()
        },
        has_timeout: false
      });
      
      service.setIncidents([incident]);
      service.verifyTimeouts();
      
      const updated = service.getIncidentById(incident.id);
      expect(updated?.has_timeout).toBe(true);
    });

    it('should not update has_timeout when timeout not expired', () => {
      const futureTimeout = new Date(Date.now() + 60000).toISOString();
      const incident = createMockIncident({
        estado: 'asignado',
        suggested_technician: {
          technician_id: 1,
          technician_name: 'Test',
          distance_km: 1,
          compatibility_score: 80,
          timeout_at: futureTimeout,
          assigned_at: new Date().toISOString()
        },
        has_timeout: false
      });
      
      service.setIncidents([incident]);
      service.verifyTimeouts();
      
      const updated = service.getIncidentById(incident.id);
      expect(updated?.has_timeout).toBe(false);
    });
  });

  describe('sortedIncidents', () => {
    it('should sort by timeout first', () => {
      const pastTimeout = new Date(Date.now() - 60000).toISOString();
      const futureTimeout = new Date(Date.now() + 60000).toISOString();
      
      const incidents = [
        createMockIncident({
          id: 1,
          prioridad: 'baja',
          suggested_technician: {
            technician_id: 1,
            technician_name: 'Test',
            distance_km: 1,
            compatibility_score: 80,
            timeout_at: futureTimeout,
            assigned_at: new Date().toISOString()
          }
        }),
        createMockIncident({
          id: 2,
          prioridad: 'alta',
          suggested_technician: {
            technician_id: 2,
            technician_name: 'Test 2',
            distance_km: 1,
            compatibility_score: 80,
            timeout_at: pastTimeout,
            assigned_at: new Date().toISOString()
          }
        })
      ];
      
      service.setIncidents(incidents);
      const sorted = service.sortedIncidents();
      
      expect(sorted[0].id).toBe(2); // Timeout incident first
    });

    it('should sort by priority when no timeout', () => {
      const incidents = [
        createMockIncident({ id: 1, prioridad: 'baja' }),
        createMockIncident({ id: 2, prioridad: 'alta' }),
        createMockIncident({ id: 3, prioridad: 'media' })
      ];
      
      service.setIncidents(incidents);
      const sorted = service.sortedIncidents();
      
      expect(sorted[0].prioridad).toBe('alta');
      expect(sorted[1].prioridad).toBe('media');
      expect(sorted[2].prioridad).toBe('baja');
    });
  });

  describe('getIncidentById', () => {
    it('should return incident by id', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      
      const found = service.getIncidentById(incident.id);
      
      expect(found).toEqual(incident);
    });

    it('should return undefined when not found', () => {
      const found = service.getIncidentById(999);
      
      expect(found).toBeUndefined();
    });
  });

  describe('getIncidentsByStatus', () => {
    it('should return incidents by status', () => {
      const incidents = [
        createMockIncident({ id: 1, estado: 'pendiente' }),
        createMockIncident({ id: 2, estado: 'asignado' }),
        createMockIncident({ id: 3, estado: 'pendiente' })
      ];
      service.setIncidents(incidents);
      
      const pending = service.getIncidentsByStatus('pendiente');
      
      expect(pending.length).toBe(2);
      expect(pending.every(i => i.estado === 'pendiente')).toBe(true);
    });
  });

  describe('getCountForFilter', () => {
    it('should return count for specific filter', () => {
      const incidents = [
        createMockIncident({ id: 1, estado: 'pendiente' }),
        createMockIncident({ id: 2, estado: 'pendiente' })
      ];
      service.setIncidents(incidents);
      
      const count = service.getCountForFilter('pending');
      
      expect(count).toBe(2);
    });
  });

  describe('clearIncidents', () => {
    it('should clear all incidents', () => {
      service.setIncidents([createMockIncident()]);
      service.clearIncidents();
      
      expect(service.incidents().length).toBe(0);
    });

    it('should clear selection', () => {
      const incident = createMockIncident();
      service.setIncidents([incident]);
      service.selectIncident(incident.id);
      
      service.clearIncidents();
      
      expect(service.selectedIncidentId()).toBeNull();
    });
  });

  describe('filter persistence', () => {
    it('should load persisted filter on initialization', () => {
      // Set filter in sessionStorage before creating service
      sessionStorage.setItem('incidents_filter', 'assigned');
      
      // Create a fresh TestBed and service instance
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [IncidentsStateService]
      });
      const newService = TestBed.inject(IncidentsStateService);
      
      expect(newService.activeFilter()).toBe('assigned');
    });

    it('should not load invalid filter', () => {
      // Set invalid filter in sessionStorage
      sessionStorage.setItem('incidents_filter', 'invalid_filter');
      
      // Create a fresh TestBed and service instance
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [IncidentsStateService]
      });
      const newService = TestBed.inject(IncidentsStateService);
      
      expect(newService.activeFilter()).toBe('all');
    });
  });
});
