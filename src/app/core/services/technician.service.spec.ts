import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TechnicianService, Technician } from './technician.service';
import { WebSocketService } from './websocket.service';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

describe('TechnicianService - WebSocket Events', () => {
  let service: TechnicianService;
  let httpMock: HttpTestingController;
  let wsService: any;
  let messagesSubject: Subject<any>;

  const mockTechnician: Technician = {
    id: 1,
    email: 'tech@example.com',
    first_name: 'John',
    last_name: 'Doe',
    phone: '1234567890',
    workshop_id: 1,
    current_latitude: null,
    current_longitude: null,
    location_updated_at: null,
    location_accuracy: null,
    is_available: true,
    is_on_duty: false,
    is_online: true,
    last_seen_at: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    messagesSubject = new Subject();
    
    const wsServiceMock = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      messages$: messagesSubject.asObservable()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TechnicianService,
        { provide: WebSocketService, useValue: wsServiceMock }
      ]
    });

    service = TestBed.inject(TechnicianService);
    httpMock = TestBed.inject(HttpTestingController);
    wsService = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('WebSocket Event Handling', () => {
    beforeEach(() => {
      // Initialize technicians state
      service['techniciansSubject'].next([mockTechnician]);
    });

    it('should handle technician_availability_changed event', () => {
      return new Promise<void>((resolve) => {
        const eventData = {
          technician_id: 1,
          workshop_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          is_available: false,
          is_on_duty: false,
          timestamp: '2024-01-01T12:00:00Z'
        };

        service.technicians$.subscribe(technicians => {
          const tech = technicians.find(t => t.id === 1);
          if (tech && tech.is_available === false) {
            expect(tech.is_available).toBe(false);
            expect(tech.updated_at).toBe(eventData.timestamp);
            resolve();
          }
        });

        messagesSubject.next({
          type: 'technician_availability_changed',
          data: eventData
        });
      });
    });

    it('should handle technician_duty_started event', () => {
      return new Promise<void>((resolve) => {
        const eventData = {
          technician_id: 1,
          workshop_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          is_available: true,
          is_on_duty: true,
          timestamp: '2024-01-01T12:00:00Z'
        };

        service.technicians$.subscribe(technicians => {
          const tech = technicians.find(t => t.id === 1);
          if (tech && tech.is_on_duty === true) {
            expect(tech.is_on_duty).toBe(true);
            expect(tech.updated_at).toBe(eventData.timestamp);
            resolve();
          }
        });

        messagesSubject.next({
          type: 'technician_duty_started',
          data: eventData
        });
      });
    });

    it('should handle technician_duty_ended event', () => {
      return new Promise<void>((resolve) => {
        // First set duty to true
        service['techniciansSubject'].next([{
          ...mockTechnician,
          is_on_duty: true
        }]);

        const eventData = {
          technician_id: 1,
          workshop_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          is_available: true,
          is_on_duty: false,
          timestamp: '2024-01-01T12:00:00Z'
        };

        service.technicians$.subscribe(technicians => {
          const tech = technicians.find(t => t.id === 1);
          if (tech && tech.is_on_duty === false && tech.updated_at === eventData.timestamp) {
            expect(tech.is_on_duty).toBe(false);
            expect(tech.updated_at).toBe(eventData.timestamp);
            resolve();
          }
        });

        messagesSubject.next({
          type: 'technician_duty_ended',
          data: eventData
        });
      });
    });

    it('should handle technician_updated event', () => {
      return new Promise<void>((resolve) => {
        const eventData = {
          technician_id: 1,
          workshop_id: 1,
          first_name: 'Jane',
          last_name: 'Smith',
          is_available: false,
          is_on_duty: true,
          timestamp: '2024-01-01T12:00:00Z'
        };

        service.technicians$.subscribe(technicians => {
          const tech = technicians.find(t => t.id === 1);
          if (tech && tech.first_name === 'Jane') {
            expect(tech.first_name).toBe('Jane');
            expect(tech.last_name).toBe('Smith');
            expect(tech.is_available).toBe(false);
            expect(tech.is_on_duty).toBe(true);
            expect(tech.updated_at).toBe(eventData.timestamp);
            resolve();
          }
        });

        messagesSubject.next({
          type: 'technician_updated',
          data: eventData
        });
      });
    });

    it('should not update state for non-existent technician', () => {
      const initialTechnicians = service['techniciansSubject'].value;
      
      messagesSubject.next({
        type: 'technician_availability_changed',
        data: {
          technician_id: 999, // Non-existent ID
          is_available: false,
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const currentTechnicians = service['techniciansSubject'].value;
      expect(currentTechnicians).toEqual(initialTechnicians);
    });

    it('should update only the changed technician without full reload', () => {
      return new Promise<void>((resolve) => {
        const tech2: Technician = {
          ...mockTechnician,
          id: 2,
          first_name: 'Jane',
          email: 'jane@example.com'
        };

        service['techniciansSubject'].next([mockTechnician, tech2]);

        const eventData = {
          technician_id: 1,
          is_available: false,
          timestamp: '2024-01-01T12:00:00Z'
        };

        service.technicians$.subscribe(technicians => {
          if (technicians.length === 2) {
            const tech1 = technicians.find(t => t.id === 1);
            const tech2Updated = technicians.find(t => t.id === 2);
            
            if (tech1 && tech1.is_available === false) {
              // Tech 1 should be updated
              expect(tech1.is_available).toBe(false);
              expect(tech1.updated_at).toBe(eventData.timestamp);
              
              // Tech 2 should remain unchanged
              expect(tech2Updated).toEqual(tech2);
              resolve();
            }
          }
        });

        messagesSubject.next({
          type: 'technician_availability_changed',
          data: eventData
        });
      });
    });
  });

  describe('State Management', () => {
    it('should load technicians and update state', () => {
      const workshopId = 1;
      const mockResponse = {
        success: true,
        data: {
          workshop_id: workshopId,
          count: 1,
          technicians: [mockTechnician]
        },
        message: 'Success'
      };

      service.loadTechnicians(workshopId);

      const req = httpMock.expectOne(`${environment.apiUrl}/technicians/workshops/${workshopId}/all?include_unavailable=true`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);

      service.technicians$.subscribe(technicians => {
        expect(technicians.length).toBe(1);
        expect(technicians[0]).toEqual(mockTechnician);
      });
    });

    it('should update technician in state', () => {
      return new Promise<void>((resolve) => {
        service['techniciansSubject'].next([mockTechnician]);

        const updatedTechnician: Technician = {
          ...mockTechnician,
          first_name: 'Updated'
        };

        service.updateTechnicianInState(updatedTechnician);

        service.technicians$.subscribe(technicians => {
          const tech = technicians.find(t => t.id === 1);
          if (tech && tech.first_name === 'Updated') {
            expect(tech.first_name).toBe('Updated');
            resolve();
          }
        });
      });
    });

    it('should remove technician from state', () => {
      return new Promise<void>((resolve) => {
        service['techniciansSubject'].next([mockTechnician]);

        service.removeTechnicianFromState(1);

        service.technicians$.subscribe(technicians => {
          if (technicians.length === 0) {
            expect(technicians.length).toBe(0);
            resolve();
          }
        });
      });
    });
  });
});
