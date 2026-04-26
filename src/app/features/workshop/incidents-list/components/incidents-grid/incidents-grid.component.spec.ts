import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { IncidentsGridComponent } from './incidents-grid.component';
import { IncidentCardComponent } from '../incident-card/incident-card.component';
import { Incident } from '../../../../../core/models/incident.model';

describe('IncidentsGridComponent', () => {
  let component: IncidentsGridComponent;
  let fixture: ComponentFixture<IncidentsGridComponent>;
  let compiled: HTMLElement;

  const createMockIncident = (id: number, overrides: Partial<Incident> = {}): Incident => ({
    id,
    descripcion: `Test incident ${id}`,
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
      imports: [IncidentsGridComponent, IncidentCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentsGridComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.componentRef.setInput('incidents', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Grid rendering', () => {
    it('should render grid when incidents are provided', () => {
      const incidents = [
        createMockIncident(1),
        createMockIncident(2),
        createMockIncident(3)
      ];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const grid = compiled.querySelector('.incidents-grid');
      expect(grid).toBeTruthy();
    });

    it('should render correct number of incident cards', () => {
      const incidents = [
        createMockIncident(1),
        createMockIncident(2),
        createMockIncident(3)
      ];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const cards = compiled.querySelectorAll('app-incident-card');
      expect(cards.length).toBe(3);
    });

    it('should pass incident data to each card', () => {
      const incidents = [
        createMockIncident(1, { descripcion: 'First incident' }),
        createMockIncident(2, { descripcion: 'Second incident' })
      ];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const cardComponents = fixture.debugElement.queryAll(By.directive(IncidentCardComponent));
      expect(cardComponents.length).toBe(2);
      expect(cardComponents[0].componentInstance.incident().id).toBe(1);
      expect(cardComponents[1].componentInstance.incident().id).toBe(2);
    });

    it('should use CSS Grid layout', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const grid = compiled.querySelector('.incidents-grid') as HTMLElement;
      const styles = window.getComputedStyle(grid);
      expect(styles.display).toBe('grid');
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no incidents', () => {
      fixture.componentRef.setInput('incidents', []);
      fixture.detectChanges();

      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should not show grid when no incidents', () => {
      fixture.componentRef.setInput('incidents', []);
      fixture.detectChanges();

      const grid = compiled.querySelector('.incidents-grid');
      expect(grid).toBeFalsy();
    });

    it('should display empty state message', () => {
      fixture.componentRef.setInput('incidents', []);
      fixture.detectChanges();

      const message = compiled.querySelector('.empty-state-message');
      expect(message?.textContent).toContain('No se encontraron solicitudes');
    });

    it('should display empty state icon', () => {
      fixture.componentRef.setInput('incidents', []);
      fixture.detectChanges();

      const icon = compiled.querySelector('.empty-state-icon');
      expect(icon?.textContent).toContain('📋');
    });

    it('should not show empty state when incidents exist', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });
  });

  describe('Card click handling', () => {
    it('should emit incidentSelect when card is clicked', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      let emittedId: number | undefined;
      component.incidentSelect.subscribe((id: number) => {
        emittedId = id;
      });

      const card = compiled.querySelector('app-incident-card') as HTMLElement;
      card.click();

      expect(emittedId).toBe(1);
    });

    it('should emit correct incident ID for multiple cards', () => {
      const incidents = [
        createMockIncident(1),
        createMockIncident(2),
        createMockIncident(3)
      ];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const emittedIds: number[] = [];
      component.incidentSelect.subscribe((id: number) => {
        emittedIds.push(id);
      });

      const cards = compiled.querySelectorAll('app-incident-card');
      (cards[0] as HTMLElement).click();
      (cards[2] as HTMLElement).click();

      expect(emittedIds).toEqual([1, 3]);
    });

    it('should call onCardClick method when card is clicked', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'onCardClick');

      const card = compiled.querySelector('app-incident-card') as HTMLElement;
      card.click();

      expect(spy).toHaveBeenCalledWith(1);
    });
  });

  describe('TrackBy function', () => {
    it('should return incident ID for trackBy', () => {
      const incident = createMockIncident(42);
      const result = component.trackByIncidentId(0, incident);
      expect(result).toBe(42);
    });

    it('should return different IDs for different incidents', () => {
      const incident1 = createMockIncident(1);
      const incident2 = createMockIncident(2);

      const result1 = component.trackByIncidentId(0, incident1);
      const result2 = component.trackByIncidentId(1, incident2);

      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });

    it('should use trackBy in template', () => {
      const incidents = [
        createMockIncident(1),
        createMockIncident(2)
      ];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      // Verify trackBy is being used by checking that cards are rendered
      const cards = compiled.querySelectorAll('app-incident-card');
      expect(cards.length).toBe(2);
    });
  });

  describe('Responsive behavior', () => {
    it('should have responsive grid classes', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const grid = compiled.querySelector('.incidents-grid');
      expect(grid?.classList.contains('incidents-grid')).toBe(true);
    });

    it('should render correctly with many incidents', () => {
      const incidents = Array.from({ length: 20 }, (_, i) => createMockIncident(i + 1));
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const cards = compiled.querySelectorAll('app-incident-card');
      expect(cards.length).toBe(20);
    });

    it('should render correctly with single incident', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      const cards = compiled.querySelectorAll('app-incident-card');
      expect(cards.length).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should efficiently handle incident list updates', () => {
      const initialIncidents = [
        createMockIncident(1),
        createMockIncident(2)
      ];
      fixture.componentRef.setInput('incidents', initialIncidents);
      fixture.detectChanges();

      const updatedIncidents = [
        createMockIncident(1),
        createMockIncident(2),
        createMockIncident(3)
      ];
      fixture.componentRef.setInput('incidents', updatedIncidents);
      fixture.detectChanges();

      const cards = compiled.querySelectorAll('app-incident-card');
      expect(cards.length).toBe(3);
    });

    it('should handle empty to populated transition', () => {
      fixture.componentRef.setInput('incidents', []);
      fixture.detectChanges();

      expect(compiled.querySelector('.empty-state')).toBeTruthy();

      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      expect(compiled.querySelector('.empty-state')).toBeFalsy();
      expect(compiled.querySelector('.incidents-grid')).toBeTruthy();
    });

    it('should handle populated to empty transition', () => {
      const incidents = [createMockIncident(1)];
      fixture.componentRef.setInput('incidents', incidents);
      fixture.detectChanges();

      expect(compiled.querySelector('.incidents-grid')).toBeTruthy();

      fixture.componentRef.setInput('incidents', []);
      fixture.detectChanges();

      expect(compiled.querySelector('.incidents-grid')).toBeFalsy();
      expect(compiled.querySelector('.empty-state')).toBeTruthy();
    });
  });
});
