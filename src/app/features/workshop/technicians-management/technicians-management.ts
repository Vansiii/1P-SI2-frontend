import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TechnicianService, type Technician, type TechnicianWorkload, type TechnicianStatistics } from '../../../core/services/technician.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService, type WebSocketMessage } from '../../../core/services/websocket.service';
import { SpecialtyService } from '../../../core/services/specialty.service';
import { AlertComponent } from '../../../shared/components/alert.component';

@Component({
  selector: 'app-technicians-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  templateUrl: './technicians-management.html',
  styleUrls: ['./technicians-management.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechniciansManagementComponent implements OnInit, OnDestroy {
  private readonly technicianService = inject(TechnicianService);
  private readonly authService = inject(AuthService);
  private readonly webSocketService = inject(WebSocketService);
  private readonly specialtyService = inject(SpecialtyService);

  readonly technicians = signal<Technician[]>([]);
  readonly selectedTechnician = signal<Technician | null>(null);
  readonly technicianWorkload = signal<TechnicianWorkload | null>(null);
  readonly technicianStatistics = signal<TechnicianStatistics | null>(null);
  readonly isLoading = signal(false);
  readonly isLoadingDetail = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly showOfflineTechnicians = signal(true);
  readonly viewMode = signal<'list' | 'map'>('list');
  readonly showCreateModal = signal(false);
  readonly showEditModal = signal(false);
  readonly editingTechnician = signal<Technician | null>(null);

  // Specialties
  readonly availableSpecialties = signal<any[]>([]);
  readonly filteredSpecialties = signal<any[]>([]);
  readonly isLoadingSpecialties = signal(false);
  readonly showSpecialtyDropdown = signal<'create' | 'edit' | null>(null);
  readonly specialtySearchQuery = signal('');

  // Form data
  readonly createForm = signal({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    specialty_ids: [] as number[]
  });

  readonly editForm = signal({
    first_name: '',
    last_name: '',
    phone: '',
    specialty_ids: [] as number[]
  });

  // Password visibility toggles
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  private map: any = null;
  private markers = new Map<number, any>();
  private miniMap: any = null;
  private L: any = null;
  private updateInterval: any = null;
  private wsSubscription: any = null;
  private clockInterval: any = null;
  private timeRefreshInterval: any = null;

  readonly timeTick = signal(Date.now());

  readonly filteredTechnicians = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const showOffline = this.showOfflineTechnicians();

    return this.technicians().filter(technician => {
      const matchesSearch =
        technician.first_name.toLowerCase().includes(query) ||
        technician.last_name.toLowerCase().includes(query) ||
        technician.email.toLowerCase().includes(query) ||
        technician.phone.toLowerCase().includes(query);

      const matchesStatus = showOffline || technician.is_online;

      return matchesSearch && matchesStatus;
    });
  });

  readonly totalTechnicians = computed(() => this.technicians().length);
  readonly onlineTechnicians = computed(() =>
    this.technicians().filter(t => t.is_online).length
  );
  readonly availableTechnicians = computed(() =>
    this.technicians().filter(t => t.is_available && t.is_online).length
  );
  readonly busyTechnicians = computed(() =>
    this.technicians().filter(t => !t.is_available && t.is_online).length
  );

  private hasLoadedInitially = false;

  constructor() {
    effect(() => {
      if (this.viewMode() === 'map') {
        setTimeout(() => {
          // Siempre destruir y recrear el mapa para evitar problemas de DOM
          if (this.map) {
            this.destroyMap();
          }
          this.initMap();
        }, 150);
      } else if (this.viewMode() === 'list' && this.map) {
        // Destruir el mapa cuando se cambia a vista de lista
        this.destroyMap();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.viewMode() === 'map' && this.map && this.filteredTechnicians().length > 0) {
        setTimeout(() => this.updateMapMarkers(), 100);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const technician = this.selectedTechnician();
      if (technician && this.viewMode() === 'list' && technician.current_latitude && technician.current_longitude) {
        setTimeout(() => this.initMiniMap(technician), 100);
      }
    }, { allowSignalWrites: true });

    // Effect para cargar técnicos cuando el usuario esté disponible (solo una vez)
    effect(() => {
      const currentUser = this.authService.currentUser();
      if (currentUser && currentUser.user_type === 'workshop' && !this.hasLoadedInitially) {
        this.hasLoadedInitially = true;
        this.loadTechnicians();
      }
    }, { allowSignalWrites: true });

    // Agregar eventos personalizados para el mapa
    document.addEventListener('selectTechnician', (event: any) => {
      const technicianId = event.detail;
      const technician = this.technicians().find(t => t.id === technicianId);
      if (technician) {
        // Primero cambiar a vista de lista
        if (this.viewMode() === 'map') {
          this.viewMode.set('list');
        }
        // Luego seleccionar el técnico con un pequeño delay para asegurar que la vista se haya cambiado
        setTimeout(() => {
          this.selectTechnician(technician);
        }, 100);
      }
    });

    document.addEventListener('centerOnTechnician', (event: any) => {
      const technicianId = event.detail;
      const technician = this.technicians().find(t => t.id === technicianId);
      if (technician) {
        this.centerMapOnTechnician(technician);
      }
    });
  }

  ngOnInit(): void {
    // No cargar aquí, el effect lo hará cuando el usuario esté disponible
    this.loadLeaflet();
    this.setupWebSocketConnection();
    this.loadSpecialties();
    
    // Iniciar reloj en tiempo real
    this.startLiveClock();
    
    // Actualizar tiempos relativos cada 10 segundos (más frecuente para mejor sincronización)
    this.timeRefreshInterval = setInterval(() => {
      this.timeTick.set(Date.now());
    }, 10_000); // 10 segundos en lugar de 60
    
    // Actualizar ubicaciones cada 30 segundos como respaldo
    this.updateInterval = setInterval(() => {
      const currentUser = this.authService.currentUser();
      if (currentUser && currentUser.user_type === 'workshop') {
        this.loadTechnicians(true); // Silent reload
      }
    }, 30000);

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.specialty-selector')) {
        this.showSpecialtyDropdown.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    if (this.timeRefreshInterval) {
      clearInterval(this.timeRefreshInterval);
    }
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.destroyMap();
    if (this.miniMap) {
      this.miniMap.remove();
    }
    this.webSocketService.disconnect();
  }

  destroyMap(): void {
    if (this.map) {
      // Limpiar todos los marcadores
      this.markers.forEach(marker => {
        if (this.map && this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      });
      this.markers.clear();
      
      // Remover el mapa completamente
      this.map.remove();
      this.map = null;
      
      // Limpiar el contenedor del DOM
      const mapContainer = document.getElementById('technicians-map');
      if (mapContainer) {
        mapContainer.innerHTML = '';
        // Remover clases de Leaflet que puedan quedar
        mapContainer.className = 'map';
      }
    }
  }

  startLiveClock(): void {
    const updateClock = () => {
      const now = new Date();
      
      // Formato de hora: HH:MM:SS
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}:${seconds}`;
      
      // Formato de fecha: DD MMM YYYY
      const dateString = now.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
      
      // Actualizar elementos del DOM
      const timeElement = document.getElementById('live-clock-time');
      const dateElement = document.getElementById('live-clock-date');
      
      if (timeElement) timeElement.textContent = timeString;
      if (dateElement) dateElement.textContent = dateString;
    };
    
    // Actualizar inmediatamente
    updateClock();
    
    // Actualizar cada segundo
    this.clockInterval = setInterval(updateClock, 1000);
  }

  async loadLeaflet() {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!(window as any).L) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    this.L = (window as any).L;
  }

  setupWebSocketConnection(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    // Connect to general WebSocket for technician updates
    this.webSocketService.connect();

    // Subscribe to WebSocket messages
    this.wsSubscription = this.webSocketService.messages$.subscribe((message: WebSocketMessage) => {
      this.handleWebSocketMessage(message);
    });
  }

  handleWebSocketMessage(message: WebSocketMessage): void {
    console.log('📩 [TechniciansManagement] WebSocket message received:', message);

    switch (message.type) {
      case 'technician_status_update':
        console.log('🔄 Handling technician status update:', message.data);
        this.handleTechnicianStatusUpdate(message.data);
        break;
      case 'technician_location_update':
        console.log('📍 Handling technician location update:', message.data);
        this.handleTechnicianLocationUpdate(message.data);
        break;
      case 'technician_online_status':
        console.log('🟢 Handling technician online status:', message.data);
        this.handleTechnicianOnlineStatus(message.data);
        break;
      case 'ping':
        // Respond to server ping
        this.webSocketService.send({ type: 'pong' });
        break;
      case 'connection_established':
        console.log('✅ WebSocket connection established:', message);
        break;
      default:
        console.log('⚠️ Unknown message type:', message.type, message);
        break;
    }
  }

  handleTechnicianStatusUpdate(data: any): void {
    const technicianId = data.technician_id;
    const isAvailable = data.is_available;
    
    // Update technician in the list
    const technicians = this.technicians();
    const updatedTechnicians = technicians.map(tech => {
      if (tech.id === technicianId) {
        return { ...tech, is_available: isAvailable };
      }
      return tech;
    });
    
    this.technicians.set(updatedTechnicians);
    
    // Update selected technician if it's the same one
    const selectedTech = this.selectedTechnician();
    if (selectedTech && selectedTech.id === technicianId) {
      this.selectedTechnician.set({ ...selectedTech, is_available: isAvailable });
    }
    
    // Update map markers if in map view
    if (this.viewMode() === 'map' && this.map) {
      this.updateMapMarkers();
    }
  }

  handleTechnicianLocationUpdate(data: any): void {
    console.log('📍 [handleTechnicianLocationUpdate] Processing location update:', data);
    
    const technicianId = data.technician_id;
    const location = data.location;
    
    console.log(`📍 Technician ${technicianId} location:`, location);
    
    // Update technician location in the list
    const technicians = this.technicians();
    console.log('📋 Current technicians count:', technicians.length);
    
    const updatedTechnicians = technicians.map(tech => {
      if (tech.id === technicianId) {
        console.log(`✅ Found technician ${technicianId}, updating location`);
        return {
          ...tech,
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          location_accuracy: location.accuracy,
          location_updated_at: new Date().toISOString(),
          is_online: true,
          last_seen_at: new Date().toISOString()
        };
      }
      return tech;
    });
    
    this.technicians.set(updatedTechnicians);
    console.log('✅ Technicians updated');
    
    // Update selected technician if it's the same one
    const selectedTech = this.selectedTechnician();
    if (selectedTech && selectedTech.id === technicianId) {
      console.log('📌 Updating selected technician');
      const updatedSelected = {
        ...selectedTech,
        current_latitude: location.latitude,
        current_longitude: location.longitude,
        location_accuracy: location.accuracy,
        location_updated_at: new Date().toISOString(),
        is_online: true,
        last_seen_at: new Date().toISOString()
      };
      this.selectedTechnician.set(updatedSelected);
      
      // Update mini map if showing details
      if (this.viewMode() === 'list') {
        setTimeout(() => this.initMiniMap(updatedSelected), 100);
      }
    }
    
    // Update map markers if in map view
    if (this.viewMode() === 'map' && this.map) {
      console.log('🗺️ Updating map markers');
      this.updateMapMarkers();
    } else {
      console.log('⚠️ Map not in view mode or not initialized');
    }
  }

  handleTechnicianOnlineStatus(data: any): void {
    const technicianId = data.technician_id;
    const isOnline = data.is_online;
    const lastSeenAt = data.last_seen_at;
    
    // Update technician online status in the list
    const technicians = this.technicians();
    const updatedTechnicians = technicians.map(tech => {
      if (tech.id === technicianId) {
        return {
          ...tech,
          is_online: isOnline,
          last_seen_at: lastSeenAt || new Date().toISOString()
        };
      }
      return tech;
    });
    
    this.technicians.set(updatedTechnicians);
    
    // Update selected technician if it's the same one
    const selectedTech = this.selectedTechnician();
    if (selectedTech && selectedTech.id === technicianId) {
      this.selectedTechnician.set({
        ...selectedTech,
        is_online: isOnline,
        last_seen_at: lastSeenAt || new Date().toISOString()
      });
    }
    
    // Update map markers if in map view
    if (this.viewMode() === 'map' && this.map) {
      this.updateMapMarkers();
    }
  }

  loadTechnicians(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);

    const currentUser = this.authService.currentUser();
    
    // Si no hay usuario, simplemente retornar sin mostrar error
    // El effect se encargará de llamar cuando esté disponible
    if (!currentUser) {
      this.isLoading.set(false);
      return;
    }

    // Verificar que el usuario sea un taller
    if (currentUser.user_type !== 'workshop') {
      this.errorMessage.set(`Acceso denegado. Solo los talleres pueden gestionar técnicos.`);
      this.isLoading.set(false);
      return;
    }

    console.log('🔄 Loading technicians for workshop:', currentUser.id);

    this.technicianService
      .getTechniciansByWorkshop(currentUser.id, true)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (technicians) => {
          console.log('✅ Technicians loaded:', technicians.length);
          console.log('📍 Technicians with location:', 
            technicians.filter(t => t.current_latitude && t.current_longitude).length
          );
          
          // Log each technician's location status
          technicians.forEach(tech => {
            if (tech.current_latitude && tech.current_longitude) {
              console.log(`📍 ${tech.first_name} ${tech.last_name}: (${tech.current_latitude}, ${tech.current_longitude}) - Updated: ${tech.location_updated_at}`);
            } else {
              console.log(`❌ ${tech.first_name} ${tech.last_name}: No location`);
            }
          });
          
          this.technicians.set(technicians);
          if (this.viewMode() === 'map' && this.map) {
            this.updateMapMarkers();
          }
        },
        error: (error) => {
          console.error('❌ Error loading technicians:', error);
          this.errorMessage.set(
            error?.error?.message || 'Error al cargar técnicos. Por favor intenta nuevamente.'
          );
        },
      });
  }

  selectTechnician(technician: Technician): void {
    this.selectedTechnician.set(technician);
    this.loadTechnicianDetails(technician.id);

    if (this.viewMode() === 'map' && technician.current_latitude && technician.current_longitude) {
      this.centerMapOnTechnician(technician);
    }
  }

  loadTechnicianDetails(technicianId: number): void {
    this.isLoadingDetail.set(true);
    this.technicianWorkload.set(null);
    this.technicianStatistics.set(null);

    // Cargar carga de trabajo
    this.technicianService
      .getTechnicianWorkload(technicianId)
      .subscribe({
        next: (workload) => {
          this.technicianWorkload.set(workload);
        },
        error: (error) => {
          console.error('Error loading workload:', error);
        },
      });

    // Cargar estadísticas
    this.technicianService
      .getTechnicianStatistics(technicianId)
      .pipe(finalize(() => this.isLoadingDetail.set(false)))
      .subscribe({
        next: (statistics) => {
          this.technicianStatistics.set(statistics);
        },
        error: (error) => {
          console.error('Error loading statistics:', error);
        },
      });
  }

  toggleAvailability(technician: Technician): void {
    const newStatus = !technician.is_available;
    const action = newStatus ? 'disponible' : 'no disponible';

    if (!confirm(`¿Marcar a ${technician.first_name} ${technician.last_name} como ${action}?`)) {
      return;
    }

    this.technicianService
      .updateAvailability(technician.id, newStatus)
      .subscribe({
        next: () => {
          technician.is_available = newStatus;
          this.technicians.set([...this.technicians()]);

          if (this.selectedTechnician()?.id === technician.id) {
            this.selectedTechnician.set({ ...technician });
          }

          this.showSuccess(`Técnico marcado como ${action}`);
        },
        error: (error) => {
          this.showError(error?.error?.message || `Error al cambiar disponibilidad`);
        },
      });
  }

  initMap() {
    const mapElement = document.getElementById('technicians-map');
    if (!mapElement || !this.L) {
      console.error('❌ Map element or Leaflet not available');
      return;
    }

    // Asegurar que el contenedor esté limpio y tenga el tamaño correcto
    mapElement.innerHTML = '';
    mapElement.className = 'map';
    mapElement.style.width = '100%';
    mapElement.style.height = '100%';
    mapElement.style.maxWidth = '100%';
    mapElement.style.boxSizing = 'border-box';

    try {
      // Crear el mapa con configuración profesional
      this.map = this.L.map('technicians-map', {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true // Mejor rendimiento
      });

      // Agregar controles personalizados
      this.L.control.zoom({
        position: 'topright'
      }).addTo(this.map);

      // Agregar múltiples capas de mapa
      const osmLayer = this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });

      const satelliteLayer = this.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19,
      });

      const terrainLayer = this.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
        maxZoom: 17,
      });

      // Agregar capa por defecto
      osmLayer.addTo(this.map);

      // Control de capas
      const baseLayers = {
        "Mapa": osmLayer,
        "Satélite": satelliteLayer,
        "Terreno": terrainLayer
      };

      this.L.control.layers(baseLayers, null, {
        position: 'topright'
      }).addTo(this.map);

      // Centrar en Bolivia por defecto
      this.map.setView([-16.5, -68.15], 6);

      // Forzar que el mapa se ajuste al contenedor
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 100);

      // Agregar controles personalizados
      this.addCustomControls();

      // Actualizar marcadores
      this.updateMapMarkers();

      console.log('✅ Map initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
      this.map = null;
    }
  }

  addCustomControls() {
    if (!this.map || !this.L) return;
    // Solo mantener los controles básicos del mapa (zoom y capas)
    // Los controles de estadísticas y filtros han sido eliminados para un diseño más limpio
  }

  updateMapMarkers() {
    if (!this.map || !this.L) return;

    // Limpiar marcadores anteriores
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers.clear();

    const techniciansWithLocation = this.filteredTechnicians().filter(
      t => t.current_latitude && t.current_longitude
    );

    if (techniciansWithLocation.length === 0) {
      console.log('No hay técnicos con ubicación disponible');
      return;
    }

    const bounds = this.L.latLngBounds([]);

    techniciansWithLocation.forEach(technician => {
      const position: [number, number] = [technician.current_latitude!, technician.current_longitude!];
      const markerColor = this.getTechnicianMarkerColor(technician);
      const isOnline = technician.is_online;
      const pulseColor = isOnline ? 'rgba(16, 185, 129, 0.4)' : 'rgba(107, 114, 128, 0.4)';

      // Crear marcador estilo Google Maps con pin
      const pinIcon = this.L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div class="pin-wrapper">
            ${isOnline ? `
              <div class="pulse-ring" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: ${pulseColor};
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              "></div>
            ` : ''}
            <div class="pin-container" style="
              position: relative;
              width: 40px;
              height: 50px;
              filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
            ">
              <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Pin principal -->
                <path d="M20 0C11.163 0 4 7.163 4 16c0 12 16 34 16 34s16-22 16-34c0-8.837-7.163-16-16-16z" 
                      fill="${markerColor}"/>
                <!-- Borde blanco -->
                <path d="M20 2C12.268 2 6 8.268 6 16c0 10.5 14 30.5 14 30.5S34 26.5 34 16c0-7.732-6.268-14-14-14z" 
                      fill="white" opacity="0.3"/>
                <!-- Círculo interior -->
                <circle cx="20" cy="16" r="8" fill="white"/>
                <!-- Iniciales del técnico -->
                <text x="20" y="20" text-anchor="middle" font-size="10" font-weight="600" fill="${markerColor}">
                  ${technician.first_name.charAt(0)}${technician.last_name.charAt(0)}
                </text>
              </svg>
            </div>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(0.8);
              }
              50% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(1.2);
              }
            }
          </style>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
      });

      const marker = this.L.marker(position, { icon: pinIcon }).addTo(this.map);

      // Popup moderno y compacto
      const statusColors: Record<string, { bg: string; border: string; text: string }> = {
        'available': { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#059669' },
        'busy': { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#dc2626' },
        'offline': { bg: 'rgba(107, 114, 128, 0.1)', border: '#6b7280', text: '#4b5563' }
      };
      
      const statusKey = !technician.is_online ? 'offline' : (technician.is_available ? 'available' : 'busy');
      const statusStyle = statusColors[statusKey];
      const statusText = this.getStatusText(technician);

      marker.bindPopup(`
        <div style="
          min-width: 260px;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          ">
            <div style="
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: linear-gradient(135deg, ${markerColor}, ${markerColor}dd);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 18px;
              font-weight: 600;
              flex-shrink: 0;
            ">
              ${technician.first_name.charAt(0)}${technician.last_name.charAt(0)}
            </div>
            <div style="flex: 1; min-width: 0;">
              <h4 style="
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
                color: #111;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              ">
                ${technician.first_name} ${technician.last_name}
              </h4>
              <span style="
                display: inline-block;
                padding: 4px 10px;
                background: ${statusStyle.bg};
                border: 1px solid ${statusStyle.border};
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                color: ${statusStyle.text};
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">
                ${statusText}
              </span>
            </div>
          </div>
          
          <div style="
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px 0;
            border-top: 1px solid rgba(0, 0, 0, 0.08);
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          ">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${technician.email}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>${technician.phone}</span>
            </div>
            ${technician.location_updated_at ? `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #999;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Actualizado ${this.formatRelativeTime(technician.location_updated_at)}</span>
              </div>
            ` : ''}
          </div>
          
          <div style="
            display: flex;
            gap: 8px;
            margin-top: 12px;
          ">
            <button onclick="document.dispatchEvent(new CustomEvent('selectTechnician', {detail: ${technician.id}}))" style="
              flex: 1;
              padding: 10px 16px;
              background: linear-gradient(135deg, #ea580c, #f97316);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            ">
              Ver Detalles
            </button>
          </div>
        </div>
      `, {
        maxWidth: 320,
        className: 'custom-popup'
      });

      // Eventos del marcador
      marker.on('click', () => {
        marker.openPopup();
      });

      this.markers.set(technician.id, marker);
      bounds.extend(position);
    });

    // Ajustar vista si hay marcadores
    if (this.markers.size > 0) {
      this.map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15
      });
    }
  }

  getTechnicianStatusClass(technician: Technician): string {
    if (!technician.is_online) return 'offline';
    if (!technician.is_available) return 'busy';
    return 'available';
  }

  getTechnicianMarkerColor(technician: Technician): string {
    if (!technician.is_online) return '#94a3b8'; // Gris claro - Offline
    if (!technician.is_available) return '#ef4444'; // Rojo - Ocupado
    return '#10b981'; // Verde - Disponible
  }

  getTechnicianStatusBadge(technician: Technician): string {
    if (!technician.is_online) {
      return `<span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
               background: #e5e7eb; color: #6b7280;">Desconectado</span>`;
    }
    if (!technician.is_available) {
      return `<span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
               background: #fee2e2; color: #991b1b;">Ocupado</span>`;
    }
    return `<span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
             background: #d1fae5; color: #065f46;">Disponible</span>`;
  }

  centerMapOnTechnician(technician: Technician) {
    if (!this.map || !technician.current_latitude || !technician.current_longitude) return;
    const position: [number, number] = [technician.current_latitude, technician.current_longitude];
    this.map.setView(position, 15);
  }

  initMiniMap(technician: Technician) {
    const mapElement = document.getElementById(`mini-map-${technician.id}`);
    if (!mapElement || !this.L || !technician.current_latitude || !technician.current_longitude) return;

    if (this.miniMap) {
      this.miniMap.remove();
    }

    const position: [number, number] = [technician.current_latitude, technician.current_longitude];

    this.miniMap = this.L.map(`mini-map-${technician.id}`, {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false
    }).setView(position, 14);

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.miniMap);

    const markerColor = this.getTechnicianMarkerColor(technician);

    this.L.circleMarker(position, {
      radius: 8,
      fillColor: markerColor,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(this.miniMap);
  }

  closeDetails(): void {
    this.selectedTechnician.set(null);
    this.technicianWorkload.set(null);
    this.technicianStatistics.set(null);

    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
    }
  }

  getStatusBadgeClass(technician: Technician): string {
    if (!technician.is_online) return 'badge-offline';
    if (!technician.is_available) return 'badge-busy';
    return 'badge-available';
  }

  getStatusText(technician: Technician): string {
    if (!technician.is_online) return 'Desconectado';
    if (!technician.is_available) return 'Ocupado';
    return 'Disponible';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatRelativeTime(dateString: string, _tick = this.timeTick()): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Manejar diferencias de sincronización de reloj
    if (diffMs < 0) {
      return 'Ahora';
    }

    if (diffSecs < 60) {
      if (diffSecs < 5) return 'Ahora';
      return `Hace ${diffSecs}s`;
    }
    
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  }

  showSuccess(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(null), 5000);
  }

  showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  loadSpecialties(): void {
    this.isLoadingSpecialties.set(true);
    this.specialtyService.getAllSpecialties()
      .pipe(finalize(() => this.isLoadingSpecialties.set(false)))
      .subscribe({
        next: (specialties) => {
          this.availableSpecialties.set(specialties);
          this.filteredSpecialties.set(specialties);
        },
        error: (error) => {
          console.error('Error loading specialties:', error);
        }
      });
  }

  toggleSpecialtyDropdown(formType: 'create' | 'edit'): void {
    if (this.showSpecialtyDropdown() === formType) {
      this.showSpecialtyDropdown.set(null);
    } else {
      this.showSpecialtyDropdown.set(formType);
      this.specialtySearchQuery.set('');
      this.filteredSpecialties.set(this.availableSpecialties());
      
      // Focus search input after dropdown opens
      setTimeout(() => {
        const searchInput = document.querySelector('.specialty-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }

  filterSpecialties(): void {
    const query = this.specialtySearchQuery().toLowerCase();
    const filtered = this.availableSpecialties().filter(specialty =>
      specialty.nombre.toLowerCase().includes(query) ||
      (specialty.descripcion && specialty.descripcion.toLowerCase().includes(query))
    );
    this.filteredSpecialties.set(filtered);
  }

  getSelectedSpecialties(formType: 'create' | 'edit'): any[] {
    const form = formType === 'create' ? this.createForm() : this.editForm();
    return this.availableSpecialties().filter(specialty => 
      form.specialty_ids.includes(specialty.id)
    );
  }

  getSelectedSpecialtiesText(formType: 'create' | 'edit'): string {
    const selected = this.getSelectedSpecialties(formType);
    if (selected.length === 0) return '';
    if (selected.length === 1) return selected[0].nombre;
    return `${selected.length} especialidades seleccionadas`;
  }

  removeSpecialty(specialtyId: number, formType: 'create' | 'edit'): void {
    if (formType === 'create') {
      const form = this.createForm();
      const newIds = form.specialty_ids.filter(id => id !== specialtyId);
      this.createForm.set({
        ...form,
        specialty_ids: newIds
      });
    } else {
      const form = this.editForm();
      const newIds = form.specialty_ids.filter(id => id !== specialtyId);
      this.editForm.set({
        ...form,
        specialty_ids: newIds
      });
    }
  }

  toggleSpecialty(specialtyId: number, formType: 'create' | 'edit'): void {
    if (formType === 'create') {
      const form = this.createForm();
      const currentIds = form.specialty_ids;
      const index = currentIds.indexOf(specialtyId);
      
      if (index > -1) {
        // Remove specialty
        const newIds = currentIds.filter(id => id !== specialtyId);
        this.createForm.set({
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          specialty_ids: newIds
        });
      } else {
        // Add specialty
        const newIds = [...currentIds, specialtyId];
        this.createForm.set({
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          specialty_ids: newIds
        });
      }
    } else {
      const form = this.editForm();
      const currentIds = form.specialty_ids;
      const index = currentIds.indexOf(specialtyId);
      
      if (index > -1) {
        // Remove specialty
        const newIds = currentIds.filter(id => id !== specialtyId);
        this.editForm.set({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          specialty_ids: newIds
        });
      } else {
        // Add specialty
        const newIds = [...currentIds, specialtyId];
        this.editForm.set({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          specialty_ids: newIds
        });
      }
    }
  }

  isSpecialtySelected(specialtyId: number, formType: 'create' | 'edit'): boolean {
    const form = formType === 'create' ? this.createForm() : this.editForm();
    return form.specialty_ids.includes(specialtyId);
  }

  // CRUD Operations
  openCreateModal(): void {
    this.createForm.set({
      email: '',
      password: '',
      confirmPassword: '',
      first_name: '',
      last_name: '',
      phone: '',
      specialty_ids: []
    });
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.showSpecialtyDropdown.set(null);
    this.specialtySearchQuery.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.showSpecialtyDropdown.set(null);
    this.specialtySearchQuery.set('');
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  createTechnician(): void {
    const form = this.createForm();
    
    // Validación básica
    if (!form.email || !form.password || !form.confirmPassword || !form.first_name || !form.last_name || !form.phone) {
      this.showError('Todos los campos son obligatorios');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      this.showError('El formato del email no es válido');
      return;
    }

    // Validar longitud de contraseña
    if (form.password.length < 8) {
      this.showError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    // Validar que las contraseñas coincidan
    if (form.password !== form.confirmPassword) {
      this.showError('Las contraseñas no coinciden');
      return;
    }

    // Validar que el email no esté ya en uso por otro técnico
    const existingTechnician = this.technicians().find(
      t => t.email.toLowerCase() === form.email.toLowerCase()
    );
    if (existingTechnician) {
      this.showError(`El email ${form.email} ya está registrado en tu taller`);
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.showError('No se pudo obtener el usuario actual');
      return;
    }

    this.isLoading.set(true);
    this.technicianService
      .createTechnician({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        workshop_id: currentUser.id,
        current_latitude: null,
        current_longitude: null,
        is_available: true,
        specialty_ids: form.specialty_ids.length > 0 ? form.specialty_ids : undefined
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (technician) => {
          this.showSuccess(`Técnico ${technician.first_name} ${technician.last_name} creado exitosamente`);
          this.closeCreateModal();
          this.loadTechnicians();
        },
        error: (error) => {
          console.error('Error creating technician:', error);
          
          // Manejar errores específicos
          if (error?.status === 409) {
            this.showError(`El email ${form.email} ya está registrado en el sistema. Por favor usa otro email.`);
          } else if (error?.status === 422) {
            // Error de validación - mostrar detalles específicos
            if (error?.error?.detail) {
              if (Array.isArray(error.error.detail)) {
                const validationErrors = error.error.detail.map((err: any) => 
                  `${err.loc?.join('.')}: ${err.msg}`
                ).join(', ');
                this.showError(`Errores de validación: ${validationErrors}`);
              } else {
                this.showError(`Error de validación: ${error.error.detail}`);
              }
            } else {
              this.showError('Error de validación en los datos enviados. Verifica que todos los campos estén correctos.');
            }
          } else if (error?.status === 404) {
            this.showError('Taller no encontrado. Contacta al administrador.');
          } else if (error?.error?.message) {
            this.showError(error.error.message);
          } else {
            this.showError('Error al crear técnico. Por favor intenta nuevamente.');
          }
        }
      });
  }

  openEditModal(technician: Technician): void {
    this.editingTechnician.set(technician);
    this.editForm.set({
      first_name: technician.first_name,
      last_name: technician.last_name,
      phone: technician.phone,
      specialty_ids: technician.especialidades?.map(e => e.id) || []
    });
    this.showSpecialtyDropdown.set(null);
    this.specialtySearchQuery.set('');
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingTechnician.set(null);
    this.showSpecialtyDropdown.set(null);
    this.specialtySearchQuery.set('');
  }

  updateTechnician(): void {
    const technician = this.editingTechnician();
    if (!technician) return;

    const form = this.editForm();
    
    // Validación básica
    if (!form.first_name || !form.last_name || !form.phone) {
      this.showError('Todos los campos son obligatorios');
      return;
    }

    this.isLoading.set(true);
    this.technicianService
      .updateTechnician(technician.id, {
        ...form,
        specialty_ids: form.specialty_ids
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (updatedTechnician) => {
          this.showSuccess('Técnico actualizado exitosamente');
          this.closeEditModal();
          this.loadTechnicians();
          
          // Actualizar técnico seleccionado si es el mismo
          if (this.selectedTechnician()?.id === updatedTechnician.id) {
            this.selectedTechnician.set(updatedTechnician);
          }
        },
        error: (error) => {
          this.showError(error?.error?.message || 'Error al actualizar técnico');
        }
      });
  }

  deleteTechnician(technician: Technician): void {
    if (!confirm(`¿Estás seguro de que deseas eliminar a ${technician.first_name} ${technician.last_name}? Esta acción desactivará su cuenta.`)) {
      return;
    }

    this.isLoading.set(true);
    this.technicianService
      .deleteTechnician(technician.id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.showSuccess('Técnico eliminado exitosamente');
          this.loadTechnicians();
          
          // Cerrar detalles si es el técnico seleccionado
          if (this.selectedTechnician()?.id === technician.id) {
            this.closeDetails();
          }
        },
        error: (error) => {
          this.showError(error?.error?.message || 'Error al eliminar técnico');
        }
      });
  }
}
