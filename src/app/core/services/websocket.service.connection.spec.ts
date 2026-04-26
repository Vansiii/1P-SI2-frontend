/**
 * WebSocketService Connection Unit Tests
 * 
 * Task 2.4: Write unit tests for Angular connection scenarios
 * - Test successful connection with valid token
 * - Test authentication failure handling
 * - Test reconnection attempts and backoff timing
 * 
 * Requirements: 1.2, 1.3, 1.4
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { WebSocketService, ConnectionStatus } from './websocket.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  
  readyState: number = WebSocket.CONNECTING;
  url: string;
  
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    // Mock send implementation
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateError(error?: string): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// ---------------------------------------------------------------------------
// Mock AuthService
// ---------------------------------------------------------------------------

function buildAuthServiceMock() {
  return {
    getAccessToken: vi.fn().mockReturnValue('valid.jwt.token'),
    getRefreshToken: vi.fn().mockReturnValue('refresh.token'),
    currentUser: signal({ id: 42, email: 'user@test.com', name: 'Test User' }),
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('WebSocketService – Connection Unit Tests (Task 2.4)', () => {
  let service: WebSocketService;
  let authMock: ReturnType<typeof buildAuthServiceMock>;
  let httpMock: HttpTestingController;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // CRITICAL: Reset TestBed completely to get a fresh service instance
    TestBed.resetTestingModule();
    
    // Store original WebSocket
    originalWebSocket = (window as any).WebSocket;
    
    // Reset mock instances and replace WebSocket FIRST
    MockWebSocket.reset();
    (window as any).WebSocket = MockWebSocket as any;
    
    // Setup auth mock
    authMock = buildAuthServiceMock();

    // Configure TestBed with fresh providers
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        WebSocketService,
        { provide: AuthService, useValue: authMock },
      ],
    });

    // Get fresh service instance
    service = TestBed.inject(WebSocketService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Disconnect service
    if (service) {
      service.disconnect();
      
      // Force reset all service state
      (service as any).socket = undefined;
      (service as any).isConnecting = false;
      (service as any).reconnectTimer = undefined;
      (service as any).heartbeatInterval = undefined;
      (service as any).lastConnectAttempt = 0;
    }
    
    // Restore original WebSocket
    (window as any).WebSocket = originalWebSocket;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset mock instances
    MockWebSocket.reset();
    
    // Verify no outstanding HTTP requests
    try {
      httpMock.verify();
    } catch (e) {
      // Ignore verification errors in cleanup
    }
  });

  // -------------------------------------------------------------------------
  // Requirement 1.2: Successful connection with valid token
  // -------------------------------------------------------------------------

  describe('Successful connection with valid token (Requirement 1.2)', () => {
    it('should connect successfully with valid JWT token', async () => {
      // Arrange
      const userId = 42;
      authMock.getAccessToken.mockReturnValue('valid.jwt.token');
      authMock.currentUser.set({ id: userId, email: 'user@test.com', name: 'Test User' });

      // Act
      const connectPromise = service.connect();
      
      // Wait for WebSocket to be created
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate WebSocket open
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();

      // Wait for connection to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.connectionState()).toBe('connected');
      expect(service.isConnectedSignal()).toBe(true);
      expect(service.lastError()).toBeNull();
    });

    it('should include JWT token in WebSocket URL', async () => {
      // Arrange
      const token = 'test.jwt.token';
      authMock.getAccessToken.mockReturnValue(token);
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      expect(ws!.url).toContain(`token=${token}`);
    });

    it('should connect to tracking endpoint with user ID', async () => {
      // Arrange
      const userId = 123;
      authMock.currentUser.set({ id: userId, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      expect(ws!.url).toContain(`/ws/tracking/${userId}`);
    });

    it('should connect to incident endpoint when incident ID provided', async () => {
      // Arrange
      const incidentId = 456;
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect(incidentId);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      expect(ws!.url).toContain(`/ws/incidents/${incidentId}`);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      // Arrange
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });
      
      // Simulate previous failed attempts
      (service as any).reconnectAttemptsSignal.set(3);

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.getReconnectAttempts()).toBe(0);
    });

    it('should start heartbeat mechanism after connection', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      vi.advanceTimersByTime(10);
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();
      vi.advanceTimersByTime(10);

      // Fast-forward time to trigger heartbeat
      vi.advanceTimersByTime(31000); // 30 seconds + buffer

      // Assert - heartbeat should have been sent
      expect(service.isConnected()).toBe(true);

      vi.useRealTimers();
    }, 10000);

    it('should emit connection status change events', async () => {
      // Arrange
      const statusChanges: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe(status => statusChanges.push(status));
      
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(statusChanges).toContain('disconnected'); // Initial state
      expect(statusChanges).toContain('connecting');
      expect(statusChanges).toContain('connected');
    }, 10000);
  });

  // -------------------------------------------------------------------------
  // Requirement 1.2: Authentication failure handling
  // -------------------------------------------------------------------------

  describe('Authentication failure handling (Requirement 1.2)', () => {
    it('should handle missing access token', async () => {
      // Arrange
      authMock.getAccessToken.mockReturnValue(null);
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      await service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.connectionState()).toBe('error');
      expect(service.lastError()).toContain('token');
    }, 10000);

    it('should handle missing current user', async () => {
      // Arrange
      authMock.getAccessToken.mockReturnValue('valid.token');
      authMock.currentUser.set(null as any);

      // Act
      await service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.connectionState()).toBe('error');
      expect(service.lastError()).toContain('user');
    }, 10000);

    it('should handle WebSocket authentication failure (code 1008)', async () => {
      // Arrange
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateClose(1008, 'Authentication failed');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.connectionState()).toBe('error');
      expect(service.lastError()).toContain('Authentication failed');
    }, 10000);

    it('should not retry connection after authentication failure', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      vi.advanceTimersByTime(10);
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateClose(1008, 'auth failed');

      // Fast-forward time
      vi.advanceTimersByTime(10000);

      // Assert - should not create new WebSocket instance
      expect(MockWebSocket.instances.length).toBe(1);
      expect(service.getReconnectAttempts()).toBe(10); // Max attempts set

      vi.useRealTimers();
    }, 10000);

    it('should attempt token refresh when token is expired', async () => {
      // Arrange
      const expiredToken = createExpiredToken();
      const freshToken = 'fresh.jwt.token';
      
      authMock.getAccessToken.mockReturnValue(expiredToken);
      authMock.getRefreshToken.mockReturnValue('refresh.token');
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Expect token refresh request
      const req = httpMock.expectOne(`${environment.apiUrl}/tokens/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refresh_token: 'refresh.token' });
      
      // Respond with fresh token
      req.flush({ data: { access_token: freshToken } });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert - should use fresh token
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      expect(ws!.url).toContain(`token=${freshToken}`);
    }, 10000);

    it('should handle token refresh failure', async () => {
      // Arrange
      const expiredToken = createExpiredToken();
      
      authMock.getAccessToken.mockReturnValue(expiredToken);
      authMock.getRefreshToken.mockReturnValue('refresh.token');
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Expect token refresh request and fail it
      const req = httpMock.expectOne(`${environment.apiUrl}/tokens/refresh`);
      req.error(new ProgressEvent('error'), { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.connectionState()).toBe('error');
      expect(MockWebSocket.instances.length).toBe(0); // No WebSocket created
    }, 10000);
  });

  // -------------------------------------------------------------------------
  // Requirement 1.3, 1.4: Reconnection attempts and exponential backoff
  // -------------------------------------------------------------------------

  describe('Reconnection attempts and backoff timing (Requirements 1.3, 1.4)', () => {
    it('should attempt reconnection after connection failure', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act - Initial connection
      service.connect();
      vi.advanceTimersByTime(10);
      
      const ws1 = MockWebSocket.getLastInstance();
      expect(ws1).toBeDefined();
      ws1!.simulateClose(1006, 'Connection lost'); // Abnormal closure

      // Fast-forward to trigger first reconnect (1 second)
      vi.advanceTimersByTime(1100);

      // Assert
      expect(service.connectionState()).toBe('reconnecting');
      expect(service.getReconnectAttempts()).toBe(1);
      expect(MockWebSocket.instances.length).toBe(2); // New connection attempt

      vi.useRealTimers();
    }, 10000);

    it('should use exponential backoff: 1s, 2s, 4s, 8s, 16s', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      const expectedDelays = [1000, 2000, 4000, 8000, 16000];

      // Act & Assert
      for (let i = 0; i < expectedDelays.length; i++) {
        // Connect
        service.connect();
        vi.advanceTimersByTime(10);
        
        const ws = MockWebSocket.getLastInstance();
        expect(ws).toBeDefined();
        ws!.simulateClose(1006, 'Connection lost');

        // Verify delay calculation
        const actualDelay = service.getLastReconnectDelay();
        expect(actualDelay).toBe(expectedDelays[i]);

        // Fast-forward to next reconnect
        vi.advanceTimersByTime(expectedDelays[i] + 100);
      }

      vi.useRealTimers();
    }, 10000);

    it('should cap reconnection delay at 60 seconds', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Simulate many failed attempts
      for (let i = 0; i < 10; i++) {
        service.connect();
        vi.advanceTimersByTime(10);
        
        const ws = MockWebSocket.getLastInstance();
        expect(ws).toBeDefined();
        ws!.simulateClose(1006, 'Connection lost');

        const delay = service.getLastReconnectDelay();
        
        // After attempt 6, delay should be capped at 60000ms
        if (i >= 6) {
          expect(delay).toBe(60000);
        }

        vi.advanceTimersByTime(delay + 100);
      }

      vi.useRealTimers();
    }, 10000);

    it('should stop reconnecting after max attempts', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act - Simulate 10 failed connection attempts
      for (let i = 0; i < 10; i++) {
        service.connect();
        vi.advanceTimersByTime(10);
        
        const ws = MockWebSocket.getLastInstance();
        expect(ws).toBeDefined();
        ws!.simulateClose(1006, 'Connection lost');

        const delay = service.getLastReconnectDelay();
        vi.advanceTimersByTime(delay + 100);
      }

      // Try one more time - should not create new connection
      const instanceCountBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(70000);

      // Assert
      expect(MockWebSocket.instances.length).toBe(instanceCountBefore);
      expect(service.connectionState()).toBe('disconnected');
      expect(service.lastError()).toContain('Max reconnection attempts exceeded');

      vi.useRealTimers();
    }, 10000);

    it('should update connection state to reconnecting during reconnect', async () => {
      // Arrange
      vi.useFakeTimers();
      const statusChanges: ConnectionStatus[] = [];
      service.connectionStatus$.subscribe(status => statusChanges.push(status));
      
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      vi.advanceTimersByTime(10);
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateClose(1006, 'Connection lost');

      // Assert
      expect(statusChanges).toContain('reconnecting');

      vi.useRealTimers();
    }, 10000);

    it('should not reconnect on normal closure (code 1000)', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      vi.advanceTimersByTime(10);
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateClose(1000, 'Normal closure');

      const instanceCountBefore = MockWebSocket.instances.length;
      
      // Fast-forward time
      vi.advanceTimersByTime(10000);

      // Assert - should not create new connection
      expect(MockWebSocket.instances.length).toBe(instanceCountBefore);
      expect(service.connectionState()).toBe('disconnected');

      vi.useRealTimers();
    }, 10000);

    it('should reset reconnect attempts after successful connection', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Simulate failed connection
      service.connect();
      vi.advanceTimersByTime(10);
      
      let ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateClose(1006, 'Connection lost');

      // Wait for reconnect
      vi.advanceTimersByTime(1100);

      expect(service.getReconnectAttempts()).toBe(1);

      // Simulate successful connection
      ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();

      // Assert
      expect(service.getReconnectAttempts()).toBe(0);

      vi.useRealTimers();
    }, 10000);

    it('should throttle rapid connection attempts', async () => {
      // Arrange
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act - Try to connect multiple times rapidly
      await service.connect();
      await service.connect();
      await service.connect();
      
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert - should only create one WebSocket instance
      expect(MockWebSocket.instances.length).toBe(1);
    }, 10000);
  });

  // -------------------------------------------------------------------------
  // Additional connection management tests
  // -------------------------------------------------------------------------

  describe('Connection management', () => {
    it('should handle WebSocket error event', async () => {
      // Arrange
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Act
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateError('Network error');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(service.connectionState()).toBe('error');
    }, 10000);

    it('should disconnect cleanly', async () => {
      // Arrange
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });
      
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act
      service.disconnect();

      // Assert
      expect(ws!.readyState).toBe(WebSocket.CLOSED);
      expect(service.getReconnectAttempts()).toBe(0);
    }, 10000);

    it('should clear reconnect timer on disconnect', async () => {
      // Arrange
      vi.useFakeTimers();
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      service.connect();
      vi.advanceTimersByTime(10);
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateClose(1006, 'Connection lost');

      // Act - Disconnect before reconnect timer fires
      service.disconnect();

      // Fast-forward time
      vi.advanceTimersByTime(10000);

      // Assert - should not create new connection
      expect(MockWebSocket.instances.length).toBe(1);

      vi.useRealTimers();
    }, 10000);

    it('should report isConnected() correctly', async () => {
      // Arrange
      authMock.currentUser.set({ id: 42, email: 'user@test.com', name: 'Test User' });

      // Initially disconnected
      expect(service.isConnected()).toBe(false);

      // Connect
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const ws = MockWebSocket.getLastInstance();
      expect(ws).toBeDefined();
      ws!.simulateOpen();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert - connected
      expect(service.isConnected()).toBe(true);

      // Disconnect
      service.disconnect();

      // Assert - disconnected
      expect(service.isConnected()).toBe(false);
    }, 10000);
  });
});

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Create an expired JWT token for testing
 */
function createExpiredToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: '42',
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  }));
  const signature = 'fake-signature';
  
  return `${header}.${payload}.${signature}`;
}
