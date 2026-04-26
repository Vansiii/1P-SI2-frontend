import { Component, inject, OnInit, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IncidentsService, type IncidentDetailAdmin } from '../../../core/services/incidents.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-incident-detail-admin',
  imports: [CommonModule, RouterLink],
  templateUrl: './incident-detail-admin.html',
  styleUrl: './incident-detail-admin.css',
  standalone: true
})
export class IncidentDetailAdminComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly incidentsService = inject(IncidentsService);

  readonly incident = signal<IncidentDetailAdmin | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  
  private map: L.Map | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    console.log('Route ID from params:', id, 'Type:', typeof id); // Debug
    
    if (id) {
      const numericId = +id;
      console.log('Numeric ID:', numericId); // Debug
      
      if (numericId > 0) {
        this.loadIncidentDetail(numericId);
      } else {
        console.error('Invalid incident ID:', id);
        this.error.set('ID de incidente inválido');
        this.loading.set(false);
      }
    } else {
      console.error('No incident ID in route');
      this.error.set('No se proporcionó un ID de incidente');
      this.loading.set(false);
    }
  }

  ngAfterViewInit(): void {
    // El mapa se inicializará después de cargar los datos del incidente
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  loadIncidentDetail(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.incidentsService.getIncidentAdminDetail(id).subscribe({
      next: (data) => {
        this.incident.set(data);
        this.loading.set(false);
        
        // Inicializar mapa después de que los datos estén cargados
        setTimeout(() => this.initMap(data), 100);
      },
      error: (err) => {
        console.error('Error loading incident detail:', err);
        this.error.set('Error al cargar los detalles del incidente');
        this.loading.set(false);
      }
    });
  }

  private initMap(incident: IncidentDetailAdmin): void {
    const mapId = `incident-map-${incident.id}`;
    const mapElement = document.getElementById(mapId);
    
    if (!mapElement) {
      console.error('Map element not found:', mapId);
      return;
    }

    try {
      // Crear el mapa
      this.map = L.map(mapId).setView([incident.latitude, incident.longitude], 15);

      // Agregar capa de tiles de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Crear icono personalizado para el marcador
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="marker-pin">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C7.802 0 4 3.403 4 7.602C4 11.8 7.469 16.812 12 24C16.531 16.812 20 11.8 20 7.602C20 3.403 16.199 0 12 0zM12 11C10.343 11 9 9.657 9 8C9 6.343 10.343 5 12 5C13.657 5 15 6.343 15 8C15 9.657 13.657 11 12 11z"/>
            </svg>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
      });

      // Agregar marcador
      const marker = L.marker([incident.latitude, incident.longitude], { icon: customIcon })
        .addTo(this.map);

      // Agregar popup con información
      const popupContent = `
        <div class="map-popup">
          <strong>Incidente #${incident.id}</strong>
          ${incident.direccion_referencia ? `<p>${incident.direccion_referencia}</p>` : ''}
          <p class="popup-coords">
            <small>Lat: ${incident.latitude.toFixed(6)}<br>
            Lng: ${incident.longitude.toFixed(6)}</small>
          </p>
        </div>
      `;
      marker.bindPopup(popupContent).openPopup();

      // Agregar círculo de área
      L.circle([incident.latitude, incident.longitude], {
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.1,
        radius: 500 // 500 metros
      }).addTo(this.map);

    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  getStatusColor(estado: string): string {
    switch (estado) {
      case 'pendiente':
        return '#f59e0b';
      case 'asignado':
        return '#3b82f6';
      case 'en_proceso':
        return '#1e40af';
      case 'resuelto':
        return '#10b981';
      case 'cancelado':
        return '#6b7280';
      case 'sin_taller_disponible':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  getStatusLabel(estado: string): string {
    const labels: Record<string, string> = {
      'pendiente': 'Pendiente',
      'asignado': 'Asignado',
      'en_proceso': 'En Proceso',
      'resuelto': 'Resuelto',
      'cancelado': 'Cancelado',
      'sin_taller_disponible': 'Sin Taller Disponible'
    };
    return labels[estado] || estado;
  }

  getPriorityColor(prioridad: string | null): string {
    switch (prioridad) {
      case 'alta':
        return '#ef4444';
      case 'media':
        return '#f59e0b';
      case 'baja':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  }

  getPriorityLabel(prioridad: string | null): string {
    const labels: Record<string, string> = {
      'alta': 'Alta',
      'media': 'Media',
      'baja': 'Baja'
    };
    return prioridad ? labels[prioridad] || prioridad : 'N/A';
  }

  getResponseStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'accepted': 'Aceptado',
      'rejected': 'Rechazado',
      'no_response': 'Sin Respuesta',
      'timeout': 'Tiempo Agotado'
    };
    return labels[status] || status;
  }

  getResponseStatusColor(status: string): string {
    switch (status) {
      case 'accepted':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      case 'no_response':
        return '#f59e0b';
      case 'timeout':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }
}
