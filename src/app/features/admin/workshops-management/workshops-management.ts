import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';

interface Workshop {
  id: number;
  email: string;
  workshop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  coverage_radius_km: number;
  is_active: boolean;
  created_at: string;
  technicians_count?: number;
}

interface Technician {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_available: boolean;
  is_active: boolean;
}

@Component({
  selector: 'app-workshops-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshops-management.html',
  styleUrl: './workshops-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkshopsManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly workshops = signal<Workshop[]>([]);
  readonly selectedWorkshop = signal<Workshop | null>(null);
  readonly technicians = signal<Technician[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingTechnicians = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly showInactiveWorkshops = signal(false);
  readonly viewMode = signal<'list' | 'map'>('list');

  private map: any = null;
  private markers: any[] = [];
  private miniMap: any = null;
  private L: any = null;

  readonly filteredWorkshops = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const showInactive = this.showInactiveWorkshops();
    
    return this.workshops().filter(workshop => {
      const matchesSearch = 
        workshop.workshop_name.toLowerCase().includes(query) ||
        workshop.owner_name.toLowerCase().includes(query) ||
        workshop.email.toLowerCase().includes(query);
      
      const matchesStatus = showInactive || workshop.is_active;
      
      return matchesSearch && matchesStatus;
    });
  });

  readonly totalWorkshops = computed(() => this.workshops().length);
  readonly activeWorkshops = computed(() => 
    this.workshops().filter(w => w.is_active).length
  );
  readonly inactiveWorkshops = computed(() => 
    this.workshops().filter(w => !w.is_active).length
  );

  constructor() {
    effect(() => {
      if (this.viewMode() === 'map' && !this.map) {
        setTimeout(() => this.initMap(), 100);
      }
    });

    effect(() => {
      if (this.viewMode() === 'map' && this.map && this.filteredWorkshops().length > 0) {
        setTimeout(() => this.updateMapMarkers(), 100);
      }
    });

    effect(() => {
      const workshop = this.selectedWorkshop();
      if (workshop && this.viewMode() === 'list') {
        setTimeout(() => this.initMiniMap(workshop), 100);
      }
    });

    effect(() => {
      if (this.viewMode() === 'map') {
        this.selectedWorkshop.set(null);
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        }, 200);
      }
    });
  }

  ngOnInit(): void {
    this.loadWorkshops();
    this.loadLeaflet();
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

  loadWorkshops(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService
      .getWorkshops({ limit: 500 })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.workshops.set(response.users);
        },
        error: (error) => {
          this.errorMessage.set(
            error?.error?.message || 'Error al cargar talleres'
          );
        },
      });
  }

  selectWorkshop(workshop: Workshop): void {
    this.selectedWorkshop.set(workshop);
    this.loadTechnicians(workshop.id);
    
    if (this.viewMode() === 'map') {
      this.centerMapOnWorkshop(workshop);
    }
  }

  loadTechnicians(workshopId: number): void {
    this.isLoadingTechnicians.set(true);
    this.technicians.set([]);

    this.adminService
      .getWorkshopTechnicians(workshopId)
      .pipe(finalize(() => this.isLoadingTechnicians.set(false)))
      .subscribe({
        next: (technicians) => {
          this.technicians.set(technicians);
        },
        error: (error) => {
          console.error('Error loading technicians:', error);
        },
      });
  }

  initMap() {
    const mapElement = document.getElementById('workshops-map');
    if (!mapElement || !this.L) return;

    this.map = this.L.map('workshops-map');

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.map.setView([-16.5, -68.15], 6);

    this.updateMapMarkers();
  }

  updateMapMarkers() {
    if (!this.map || !this.L) return;

    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];

    if (this.filteredWorkshops().length === 0) return;

    const bounds = this.L.latLngBounds([]);

    this.filteredWorkshops().forEach(workshop => {
      if (!workshop.latitude || !workshop.longitude) return;

      const position: [number, number] = [workshop.latitude, workshop.longitude];
      const markerColor = workshop.is_active ? '#10b981' : '#ef4444';
      
      const pinIcon = this.L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div style="position: relative; width: 32px; height: 45px;">
            <div style="
              position: absolute;
              width: 28px;
              height: 28px;
              background: ${markerColor};
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              top: 0;
              left: 2px;
            "></div>
            <div style="
              position: absolute;
              width: 8px;
              height: 8px;
              background: white;
              border-radius: 50%;
              top: 7px;
              left: 12px;
              z-index: 1;
            "></div>
          </div>
        `,
        iconSize: [32, 45],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
      });
      
      const marker = this.L.marker(position, { icon: pinIcon }).addTo(this.map);

      const statusBadge = workshop.is_active
        ? `<span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
             background: #d1fae5; color: #065f46;">Activo</span>`
        : `<span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
             background: #fee2e2; color: #991b1b;">Inactivo</span>`;

      marker.bindPopup(`
        <div style="min-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 16px; color: #111827;">${workshop.workshop_name}</strong>
            ${statusBadge}
          </div>
          <div style="margin-bottom: 8px;">
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">
              <strong>Propietario:</strong> ${workshop.owner_name}
            </div>
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
              📧 ${workshop.email}
            </div>
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
              📞 ${workshop.phone}
            </div>
          </div>
          ${workshop.address ? `
            <div style="display: flex; align-items: start; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                ${workshop.address}
              </span>
            </div>
          ` : ''}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <span style="font-size: 12px; color: #9ca3af;">
              Radio de cobertura: ${workshop.coverage_radius_km} km
            </span>
          </div>
          <button onclick="document.dispatchEvent(new CustomEvent('selectWorkshop', {detail: ${workshop.id}}))"
                  style="width: 100%; margin-top: 12px; padding: 8px; background: #667eea; color: white; 
                         border: none; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">
            Ver Detalles
          </button>
        </div>
      `, {
        maxWidth: 320,
        className: 'custom-popup'
      });

      marker.on('click', () => {
        this.selectWorkshop(workshop);
      });

      this.markers.push(marker);
      bounds.extend(position);
    });

    if (this.markers.length > 0) {
      this.map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 15 
      });
    }
  }

  centerMapOnWorkshop(workshop: Workshop) {
    if (!this.map) return;
    const position: [number, number] = [workshop.latitude, workshop.longitude];
    this.map.setView(position, 15);
  }

  initMiniMap(workshop: Workshop) {
    const mapElement = document.getElementById(`mini-map-${workshop.id}`);
    if (!mapElement || !this.L) return;

    if (this.miniMap) {
      this.miniMap.remove();
    }

    const position: [number, number] = [workshop.latitude, workshop.longitude];

    this.miniMap = this.L.map(`mini-map-${workshop.id}`, {
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

    this.L.circleMarker(position, {
      radius: 8,
      fillColor: workshop.is_active ? '#10b981' : '#ef4444',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(this.miniMap);
  }

  toggleWorkshopStatus(workshop: Workshop): void {
    const action = workshop.is_active ? 'desactivar' : 'activar';
    
    if (!confirm(`¿Estás seguro de ${action} este taller?`)) {
      return;
    }

    this.adminService
      .toggleWorkshopStatus(workshop.id, !workshop.is_active)
      .subscribe({
        next: () => {
          workshop.is_active = !workshop.is_active;
          this.workshops.set([...this.workshops()]);
          
          if (this.selectedWorkshop()?.id === workshop.id) {
            this.selectedWorkshop.set({...workshop});
          }
        },
        error: (error) => {
          alert(error?.error?.message || `Error al ${action} taller`);
        },
      });
  }

  closeDetails(): void {
    this.selectedWorkshop.set(null);
    this.technicians.set([]);
    
    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
    }
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'badge-success' : 'badge-inactive';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Activo' : 'Inactivo';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
