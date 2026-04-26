import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { IncidentsListComponent } from './incidents-list';

describe('IncidentsListComponent - Virtual Scroll', () => {
  let component: IncidentsListComponent;
  let fixture: ComponentFixture<IncidentsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        IncidentsListComponent,
        HttpClientTestingModule,
        RouterTestingModule,
        ScrollingModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentsListComponent);
    component = fixture.componentInstance;
  });

  it('should create component with virtual scroll', () => {
    expect(component).toBeTruthy();
  });

  it('should have trackBy function for virtual scroll', () => {
    const mockIncident = {
      id: 1,
      descripcion: 'Test incident',
      estado_actual: 'pendiente',
      prioridad_ia: null,
      categoria_ia: null,
      created_at: '2024-01-01T00:00:00Z',
      direccion_referencia: null,
      latitude: 0,
      longitude: 0,
      client_id: 1,
      vehiculo_id: 1,
      taller_id: null,
      tecnico_id: null,
      technician: null,
      workshop: null
    };

    const result = component.trackByIncidentId(0, mockIncident);
    expect(result).toBe(1);
  });

  it('should have computed virtual scroll item size', () => {
    expect(component.virtualScrollItemSize()).toBeGreaterThan(0);
  });

  it('should render virtual scroll viewport in template', () => {
    // Set some mock data
    component.incidents.set([
      {
        id: 1,
        descripcion: 'Test incident 1',
        estado_actual: 'pendiente',
        prioridad_ia: null,
        categoria_ia: null,
        created_at: '2024-01-01T00:00:00Z',
        direccion_referencia: null,
        latitude: 0,
        longitude: 0,
        client_id: 1,
        vehiculo_id: 1,
        taller_id: null,
        tecnico_id: null,
        technician: null,
        workshop: null
      }
    ]);

    fixture.detectChanges();

    const viewport = fixture.nativeElement.querySelector('cdk-virtual-scroll-viewport');
    expect(viewport).toBeTruthy();
    expect(viewport.classList.contains('incidents-viewport')).toBe(true);
  });
});