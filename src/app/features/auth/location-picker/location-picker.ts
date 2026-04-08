import { Component, output, input, effect, signal, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-location-picker',
  standalone: true,
  template: `
    <div class="location-picker">
      <div class="map-controls">
        @if (!readonly()) {
          <button type="button" class="center-button" (click)="centerOnUserLocation()" [disabled]="isLocating()">
            @if (isLocating()) {
              <span class="spinner-small"></span>
            } @else {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            }
            Centrar en mi ubicación
          </button>
        }
      </div>
      <div #mapContainer id="map" class="map-container"></div>
      <div class="map-info">
        @if (locationAddress()) {
          <p class="address-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <strong>{{ locationAddress() }}</strong>
          </p>
        }
        @if (selectedLocation()) {
          <p class="coordinates">
            Coordenadas: {{ selectedLocation()!.lat.toFixed(6) }}, {{ selectedLocation()!.lng.toFixed(6) }}
          </p>
        } @else {
          <p class="hint">Haz clic en el mapa para seleccionar la ubicación del taller</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .location-picker {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      position: relative;
    }

    .map-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1000;
    }

    .center-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: all 0.2s;
    }

    .center-button:hover:not(:disabled) {
      background: #f9fafb;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .center-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid #e5e7eb;
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .map-container {
      width: 100%;
      height: 400px;
      background: #f3f4f6;
    }

    .map-info {
      padding: 12px 16px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }

    .address-info {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .address-info svg {
      flex-shrink: 0;
      color: var(--primary);
    }

    .coordinates {
      margin: 0;
      font-size: 13px;
      color: #6b7280;
      font-family: 'Courier New', monospace;
    }

    .hint {
      margin: 0;
      font-size: 14px;
      color: #6b7280;
      font-style: italic;
    }
  `]
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
  initialLocation = input<{ lat: number; lng: number }>({ lat: -17.3935, lng: -66.1570 }); // Cochabamba, Bolivia
  readonly = input<boolean>(false);
  locationSelected = output<{ lat: number; lng: number; address: string }>();
  
  selectedLocation = signal<{ lat: number; lng: number } | null>(null);
  locationAddress = signal<string>('');
  isLocating = signal(false);
  
  private map: any = null;
  private marker: any = null;
  private L: any = null;

  constructor() {
    effect(() => {
      const loc = this.initialLocation();
      if (this.map && loc && loc.lat !== 0 && loc.lng !== 0) {
        this.map.setView([loc.lat, loc.lng], 15);
        if (this.marker) {
          this.marker.setLatLng([loc.lat, loc.lng]);
        }
        this.selectedLocation.set(loc);
        this.reverseGeocode(loc.lat, loc.lng);
      }
    });
  }

  async ngAfterViewInit() {
    await this.loadLeaflet();
    await this.initMap();
    if (!this.readonly()) {
      // Auto-detect user location on load only if not readonly
      this.centerOnUserLocation();
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private async loadLeaflet() {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
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

  private async initMap() {
    const initial = this.initialLocation();
    
    this.map = this.L.map('map').setView([initial.lat, initial.lng], 15);

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    // Add marker
    this.marker = this.L.marker([initial.lat, initial.lng], {
      draggable: !this.readonly()
    }).addTo(this.map);

    if (!this.readonly()) {
      // Handle marker drag
      this.marker.on('dragend', () => {
        const position = this.marker.getLatLng();
        this.updateLocation(position.lat, position.lng);
      });

      // Handle map click
      this.map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        this.marker.setLatLng([lat, lng]);
        this.updateLocation(lat, lng);
      });
    }

    if (initial.lat !== 0 && initial.lng !== 0) {
      this.selectedLocation.set(initial);
      await this.reverseGeocode(initial.lat, initial.lng);
    }
  }

  async centerOnUserLocation() {
    if (!('geolocation' in navigator)) {
      return;
    }

    this.isLocating.set(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (this.map && this.marker) {
        this.map.setView([lat, lng], 16);
        this.marker.setLatLng([lat, lng]);
        await this.updateLocation(lat, lng);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      this.isLocating.set(false);
    }
  }

  private async updateLocation(lat: number, lng: number) {
    this.selectedLocation.set({ lat, lng });
    const address = await this.reverseGeocode(lat, lng);
    this.locationSelected.emit({ lat, lng, address });
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.address) {
        const parts = [];
        
        // Build address from components
        if (data.address.road) parts.push(data.address.road);
        if (data.address.suburb) parts.push(data.address.suburb);
        if (data.address.city) parts.push(data.address.city);
        else if (data.address.town) parts.push(data.address.town);
        else if (data.address.village) parts.push(data.address.village);
        
        if (data.address.state) parts.push(data.address.state);
        if (data.address.country) parts.push(data.address.country);
        
        const address = parts.join(', ') || data.display_name;
        this.locationAddress.set(address);
        return address;
      }
      
      this.locationAddress.set('Ubicación seleccionada');
      return 'Ubicación seleccionada';
    } catch (error) {
      console.error('Geocoding error:', error);
      this.locationAddress.set('Ubicación seleccionada');
      return 'Ubicación seleccionada';
    }
  }
}
