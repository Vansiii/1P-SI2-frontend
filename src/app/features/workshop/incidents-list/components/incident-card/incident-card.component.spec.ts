import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { IncidentCardComponent } from './incident-card.component';
import { Incident, IncidentPriority, IncidentStatus } from '../../../../../core/models/incident.model';

describe('IncidentCardComponent', () => {
  let component: IncidentCardComponent;
  let fixture: ComponentFixture<IncidentCardComponent>;
  let compiled: HTMLElement;

  const createMockIncident = (overrides: Partial<Incident> = {}): Incident => ({
    id: 1,
    descripcion: 'Test incident description',
    prioridad: 'media',
    estado: 'pendiente',
    cliente_id: 1,
    vehiculo_id: 1,
    categoria_id: 1,
    taller_id: null,
    tecnico_id: null,
    ubicacion: 'Test Location',
    latitud: -17.7833,
    longitud: -63.1821,
    direccion_referencia: null,
    suggested_technician: null,
    rejection_count: 0,
    has_timeout: false,
    timeout_at: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    categoria: {
      id: 1,
      nombre: 'Mecánica',
      descripcion: 'Problemas mecánicos',
      icono: null
    },
    ...overrides
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentCardComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.componentRef.setInput('incident', createMockIncident());
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Card rendering', () => {
    it('should render incident ID', () => {
      const incident = createMockIncident({ id: 123 });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const idElement = compiled.querySelector('.id-label');
      expect(idElement?.textContent).toContain('#123');
    });

    it('should render truncated description', () => {
      const longDescription = 'A'.repeat(150);
      const incident = createMockIncident({ descripcion: longDescription });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const descElement = compiled.querySelector('.description');
      expect(descElement?.textContent?.length).toBeLessThanOrEqual(104); // 100 + '...'
      expect(descElement?.textContent).toContain('...');
    });

    it('should render full description when under 100 chars', () => {
      const shortDescription = 'Short description';
      const incident = createMockIncident({ descripcion: shortDescription });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const descElement = compiled.querySelector('.description');
      expect(descElement?.textContent).toBe(shortDescription);
      expect(descElement?.textContent).not.toContain('...');
    });

    it('should render category name', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const metadataText = compiled.querySelectorAll('.metadata-text');
      expect(metadataText[0]?.textContent).toContain('Mecánica');
    });

    it('should render location', () => {
      const incident = createMockIncident({ ubicacion: 'Santa Cruz' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const metadataText = compiled.querySelectorAll('.metadata-text');
      expect(metadataText[1]?.textContent).toContain('Santa Cruz');
    });

    it('should render formatted date', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const metadataText = compiled.querySelectorAll('.metadata-text');
      expect(metadataText[2]?.textContent).toBeTruthy();
    });
  });

  describe('Priority badge', () => {
    it('should display priority badge with correct text for alta', () => {
      const incident = createMockIncident({ prioridad: 'alta' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const badge = compiled.querySelector('.priority-badge');
      expect(badge?.textContent?.trim()).toBe('ALTA');
    });

    it('should display priority badge with correct color for alta', () => {
      const incident = createMockIncident({ prioridad: 'alta' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const badge = compiled.querySelector('.priority-badge') as HTMLElement;
      expect(badge?.style.backgroundColor).toBe('rgb(239, 68, 68)'); // #ef4444
    });

    it('should display priority badge with correct color for media', () => {
      const incident = createMockIncident({ prioridad: 'media' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const badge = compiled.querySelector('.priority-badge') as HTMLElement;
      expect(badge?.style.backgroundColor).toBe('rgb(245, 158, 11)'); // #f59e0b
    });

    it('should display priority badge with correct color for baja', () => {
      const incident = createMockIncident({ prioridad: 'baja' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const badge = compiled.querySelector('.priority-badge') as HTMLElement;
      expect(badge?.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6
    });
  });

  describe('Status badge', () => {
    it('should display status badge with correct text', () => {
      const incident = createMockIncident({ estado: 'en_proceso' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const badge = compiled.querySelector('.status-badge');
      expect(badge?.textContent?.trim()).toBe('EN PROCESO');
    });

    it('should display status badge with correct color', () => {
      const incident = createMockIncident({ estado: 'asignado' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const badge = compiled.querySelector('.status-badge') as HTMLElement;
      expect(badge?.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6
    });
  });

  describe('Timeout badge', () => {
    it('should show timeout badge when timeout has expired', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: pastDate,
          assigned_at: new Date(Date.now() - 120000).toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const timeoutBadge = compiled.querySelector('.timeout-badge');
      expect(timeoutBadge).toBeTruthy();
      expect(timeoutBadge?.textContent).toContain('TIMEOUT');
    });

    it('should not show timeout badge when timeout has not expired', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: futureDate,
          assigned_at: new Date().toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const timeoutBadge = compiled.querySelector('.timeout-badge');
      expect(timeoutBadge).toBeFalsy();
    });

    it('should not show timeout badge when no suggested technician', () => {
      const incident = createMockIncident({ suggested_technician: null });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const timeoutBadge = compiled.querySelector('.timeout-badge');
      expect(timeoutBadge).toBeFalsy();
    });
  });

  describe('Time remaining indicator', () => {
    it('should show time remaining when timeout is in future', () => {
      const futureDate = new Date(Date.now() + 300000).toISOString(); // 5 minutes from now
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: futureDate,
          assigned_at: new Date().toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const timeRemaining = compiled.querySelector('.time-remaining');
      expect(timeRemaining).toBeTruthy();
      expect(timeRemaining?.textContent).toContain('m restantes');
    });

    it('should not show time remaining when timeout has expired', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: pastDate,
          assigned_at: new Date(Date.now() - 120000).toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const timeRemaining = compiled.querySelector('.time-remaining');
      expect(timeRemaining).toBeFalsy();
    });
  });

  describe('No assignment badge', () => {
    it('should show "Sin asignación" badge when no suggested technician', () => {
      const incident = createMockIncident({ suggested_technician: null });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const noAssignmentBadge = compiled.querySelector('.no-assignment-badge');
      expect(noAssignmentBadge).toBeTruthy();
      expect(noAssignmentBadge?.textContent?.trim()).toBe('Sin asignación');
    });

    it('should not show "Sin asignación" badge when has suggested technician', () => {
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: new Date(Date.now() + 60000).toISOString(),
          assigned_at: new Date().toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const noAssignmentBadge = compiled.querySelector('.no-assignment-badge');
      expect(noAssignmentBadge).toBeFalsy();
    });
  });

  describe('Host bindings', () => {
    it('should add has-timeout class when timeout expired', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: pastDate,
          assigned_at: new Date(Date.now() - 120000).toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(compiled.classList.contains('has-timeout')).toBe(true);
    });

    it('should add high-priority class when priority is alta', () => {
      const incident = createMockIncident({ prioridad: 'alta' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(compiled.classList.contains('high-priority')).toBe(true);
    });

    it('should not add high-priority class when priority is not alta', () => {
      const incident = createMockIncident({ prioridad: 'media' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(compiled.classList.contains('high-priority')).toBe(false);
    });

    it('should have role="button" attribute', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(compiled.getAttribute('role')).toBe('button');
    });

    it('should have tabindex="0" attribute', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(compiled.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('Computed signals', () => {
    it('should compute hasTimeout correctly', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: pastDate,
          assigned_at: new Date(Date.now() - 120000).toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(component.hasTimeout()).toBe(true);
    });

    it('should compute isHighPriority correctly', () => {
      const incident = createMockIncident({ prioridad: 'alta' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(component.isHighPriority()).toBe(true);
    });

    it('should compute timeRemaining in minutes', () => {
      const futureDate = new Date(Date.now() + 300000).toISOString(); // 5 minutes
      const incident = createMockIncident({
        suggested_technician: {
          technician_id: 1,
          technician_name: 'John Doe',
          distance_km: 5,
          compatibility_score: 0.9,
          timeout_at: futureDate,
          assigned_at: new Date().toISOString()
        }
      });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const remaining = component.timeRemaining();
      expect(remaining).toBeGreaterThanOrEqual(4);
      expect(remaining).toBeLessThanOrEqual(5);
    });

    it('should return null for timeRemaining when no timeout', () => {
      const incident = createMockIncident({ suggested_technician: null });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(component.timeRemaining()).toBeNull();
    });
  });
});
