import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

export interface HeatmapPoint {
  latitud: number;
  longitud: number;
  total: number;
  categorias: string;
}

@Component({
  selector: 'app-incident-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `<div #mapContainer [style.height]="height" style="border-radius: 16px; border: 1px solid var(--border-light);"></div>`,
  styles: [],
})
export class IncidentHeatmapComponent implements AfterViewInit, OnChanges {
  @Input() hotspots: HeatmapPoint[] = [];
  @Input() centerLat = -17.783;
  @Input() centerLng = -63.182;
  @Input() height = '400px';

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private circlesLayer = L.layerGroup();

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hotspots'] && this.map) {
      this.updateHotspots();
    }
  }

  private initMap(): void {
    if (this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [this.centerLat, this.centerLng],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    this.circlesLayer.addTo(this.map);
    this.updateHotspots();
  }

  private updateHotspots(): void {
    if (!this.map) return;
    this.circlesLayer.clearLayers();

    if (!this.hotspots || this.hotspots.length === 0) return;

    const maxTotal = Math.max(...this.hotspots.map((h) => h.total), 1);

    for (const hotspot of this.hotspots) {
      const intensity = hotspot.total / maxTotal;
      const radius = 800 + intensity * 4000;
      const color = this.getColor(intensity);

      const circle = L.circle([hotspot.latitud, hotspot.longitud], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 2,
      });

      circle.bindTooltip(
        `<strong>${hotspot.total} incidentes</strong><br/><small>${hotspot.categorias || 'Sin clasificar'}</small>`,
        { direction: 'top' }
      );

      circle.addTo(this.circlesLayer);
    }

    const bounds = L.latLngBounds(
      this.hotspots.map((h) => [h.latitud, h.longitud] as [number, number])
    );
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  private getColor(intensity: number): string {
    if (intensity >= 0.75) return '#dc2626';
    if (intensity >= 0.5) return '#f97316';
    if (intensity >= 0.25) return '#eab308';
    return '#3b82f6';
  }
}
