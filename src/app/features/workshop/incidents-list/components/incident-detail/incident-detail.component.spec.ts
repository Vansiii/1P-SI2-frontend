import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { IncidentDetailComponent } from './incident-detail.component';
import { IncidentsService } from '../../../../../core/services/incidents.service';
import { WebSocketService } from '../../../../../core/services/websocket.service';
import { Incident, AIAnalysis } from '../../../../../core/models/incident.model';
import { RealtimeEvent } from '../../../../../core/models/realtime-events.models';

describe('IncidentDetailComponent', () => {
  let component: IncidentDetailComponent;
  let fixture: ComponentFixture<IncidentDetailComponent>;
  let compiled: HTMLElement;
  let mockIncidentsService: any;
  let mockWebSocketService: any;
  let mockRouter: any;
  let messagesSubject: Subject<RealtimeEvent>;

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
    cliente: {
      id: 1,
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      telefono: '12345678',
      created_at: '2024-01-01T00:00:00Z'
    },
    vehiculo: {
      id: 1,
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: 2020,
      placa: 'ABC123',
      color: 'Blanco',
      cliente_id: 1
    },
    ...overrides
  });

  beforeEach(async () => {
    messagesSubject = new Subject<RealtimeEvent>();

    mockIncidentsService = {
      getAIAnalysis: vi.fn(),
      acceptIncident: vi.fn(),
      rejectIncident: vi.fn()
    };

    mockWebSocketService = {
      messages$: messagesSubject.asObservable()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [IncidentDetailComponent],
      providers: [
        { provide: IncidentsService, useValue: mockIncidentsService },
        { provide: WebSocketService, useValue: mockWebSocketService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentDetailComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.componentRef.setInput('incident', createMockIncident());
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Component rendering', () => {
    it('should display incident ID in title', () => {
      const incident = createMockIncident({ id: 123 });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const title = compiled.querySelector('.panel-title');
      expect(title?.textContent).toContain('#123');
    });

    it('should display incident description', () => {
      const incident = createMockIncident({ descripcion: 'Test description' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const description = compiled.querySelector('.description');
      expect(description?.textContent).toContain('Test description');
    });

    it('should display client information', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const content = compiled.textContent;
      expect(content).toContain('Juan Pérez');
      expect(content).toContain('juan@test.com');
    });

    it('should display vehicle information', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const content = compiled.textContent;
      expect(content).toContain('Toyota Corolla');
      expect(content).toContain('ABC123');
    });

    it('should display location information', () => {
      const incident = createMockIncident({ ubicacion: 'Santa Cruz' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const content = compiled.textContent;
      expect(content).toContain('Santa Cruz');
    });
  });

  describe('Action buttons', () => {
    it('should show accept button when incident is pendiente', () => {
      const incident = createMockIncident({ estado: 'pendiente' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const acceptButton = compiled.querySelector('.accept-button');
      expect(acceptButton).toBeTruthy();
    });

    it('should show reject button when incident is pendiente', () => {
      const incident = createMockIncident({ estado: 'pendiente' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const rejectButton = compiled.querySelector('.reject-button');
      expect(rejectButton).toBeTruthy();
    });

    it('should show tracking button when incident is aceptado', () => {
      const incident = createMockIncident({ estado: 'aceptado' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const trackingButton = compiled.querySelector('.tracking-button');
      expect(trackingButton).toBeTruthy();
    });

    it('should not show accept button when incident is resuelto', () => {
      const incident = createMockIncident({ estado: 'resuelto' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const acceptButton = compiled.querySelector('.accept-button');
      expect(acceptButton).toBeFalsy();
    });
  });

  describe('Close functionality', () => {
    it('should emit close event when close button is clicked', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      let closeEmitted = false;
      component.close.subscribe(() => {
        closeEmitted = true;
      });

      const closeButton = compiled.querySelector('.close-button') as HTMLElement;
      closeButton.click();

      expect(closeEmitted).toBe(true);
    });

    it('should emit close event when overlay is clicked', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      let closeEmitted = false;
      component.close.subscribe(() => {
        closeEmitted = true;
      });

      const overlay = compiled.querySelector('.detail-overlay') as HTMLElement;
      overlay.click();

      expect(closeEmitted).toBe(true);
    });

    it('should not close when panel is clicked', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      let closeEmitted = false;
      component.close.subscribe(() => {
        closeEmitted = true;
      });

      const panel = compiled.querySelector('.detail-panel') as HTMLElement;
      panel.click();

      expect(closeEmitted).toBe(false);
    });
  });

  describe('Modal controls', () => {
    it('should open accept modal when accept button is clicked', () => {
      const incident = createMockIncident({ estado: 'pendiente' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const acceptButton = compiled.querySelector('.accept-button') as HTMLElement;
      acceptButton.click();

      expect(component.showAcceptModal()).toBe(true);
    });

    it('should open reject modal when reject button is clicked', () => {
      const incident = createMockIncident({ estado: 'pendiente' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const rejectButton = compiled.querySelector('.reject-button') as HTMLElement;
      rejectButton.click();

      expect(component.showRejectModal()).toBe(true);
    });
  });

  describe('Navigation', () => {
    it('should navigate to tracking when tracking button is clicked', () => {
      const incident = createMockIncident({ id: 123, estado: 'aceptado' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const trackingButton = compiled.querySelector('.tracking-button') as HTMLElement;
      trackingButton.click();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/tracking', 123],
        expect.objectContaining({
          state: expect.objectContaining({ incident: expect.any(Object) })
        })
      );
    });
  });

  describe('AI Analysis', () => {
    it('should load AI analysis on init if available', async () => {
      const mockAnalysis: AIAnalysis = {
        id: 1,
        incident_id: 1,
        analysis: 'Test analysis',
        suggested_category: 'Mecánica',
        suggested_priority: 'alta',
        confidence_score: 0.95,
        processing_status: 'completed',
        created_at: '2024-01-15T10:00:00Z'
      };

      mockIncidentsService.getAIAnalysis.mockResolvedValue(mockAnalysis);

      const incident = createMockIncident({ ai_analysis: mockAnalysis });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      await fixture.whenStable();

      expect(mockIncidentsService.getAIAnalysis).toHaveBeenCalledWith(1);
    });

    it('should not load AI analysis if not available', () => {
      const incident = createMockIncident({ ai_analysis: undefined });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(mockIncidentsService.getAIAnalysis).not.toHaveBeenCalled();
    });
  });

  describe('Real-time updates', () => {
    it('should close detail when incident is accepted by another workshop', (done) => {
      const incident = createMockIncident({ id: 1 });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      component.close.subscribe(() => {
        done();
      });

      messagesSubject.next({
        type: 'incident.assignment_accepted',
        data: { incident_id: 1 }
      } as any);
    });

    it('should close detail when incident is cancelled', (done) => {
      const incident = createMockIncident({ id: 1 });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      component.close.subscribe(() => {
        done();
      });

      messagesSubject.next({
        type: 'incident.cancelled',
        data: { incident_id: 1 }
      } as any);
    });

    it('should not close detail for events from other incidents', () => {
      const incident = createMockIncident({ id: 1 });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      let closeEmitted = false;
      component.close.subscribe(() => {
        closeEmitted = true;
      });

      messagesSubject.next({
        type: 'incident.assignment_accepted',
        data: { incident_id: 999 }
      } as any);

      expect(closeEmitted).toBe(false);
    });
  });

  describe('Helper methods', () => {
    it('should format date correctly', () => {
      const incident = createMockIncident();
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      const formatted = component.formatDate('2024-01-15T10:30:00Z');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should return correct status text', () => {
      const incident = createMockIncident({ estado: 'en_proceso' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(component.getStatusText()).toBe('EN PROCESO');
    });

    it('should return correct priority text', () => {
      const incident = createMockIncident({ prioridad: 'alta' });
      fixture.componentRef.setInput('incident', incident);
      fixture.detectChanges();

      expect(component.getPriorityText()).toBe('ALTA');
    });

    it('should correctly determine if incident can be accepted', () => {
      const pendiente = createMockIncident({ estado: 'pendiente' });
      fixture.componentRef.setInput('incident', pendiente);
      expect(component.canAccept()).toBe(true);

      const resuelto = createMockIncident({ estado: 'resuelto' });
      fixture.componentRef.setInput('incident', resuelto);
      expect(component.canAccept()).toBe(false);
    });

    it('should correctly determine if can go to tracking', () => {
      const aceptado = createMockIncident({ estado: 'aceptado' });
      fixture.componentRef.setInput('incident', aceptado);
      expect(component.canGoToTracking()).toBe(true);

      const pendiente = createMockIncident({ estado: 'pendiente' });
      fixture.componentRef.setInput('incident', pendiente);
      expect(component.canGoToTracking()).toBe(false);
    });
  });
});
