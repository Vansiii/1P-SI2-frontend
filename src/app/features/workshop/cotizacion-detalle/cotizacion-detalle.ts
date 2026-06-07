import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CotizacionesService } from '../../../core/services/cotizaciones.service';
import { ServiceCatalogService, CatalogItem } from '../../../core/services/service-catalog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Cotizacion, ServicioCotizado, ESTADO_COTIZACION_LABELS, ESTADO_COTIZACION_COLORS } from '../../../core/models/cotizacion.model';

@Component({
  selector: 'app-cotizacion-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cotizacion-detalle.html',
  styles: [`
    .container { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .back-link { font-size: 0.875rem; color: #f97316; text-decoration: none; display: inline-block; margin-bottom: 1rem; }
    .detail-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; }
    .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .detail-header h2 { font-size: 1.25rem; font-weight: 700; color: #111827; }
    .badge { font-size: 0.75rem; padding: 0.2rem 0.7rem; border-radius: 9999px; font-weight: 500; color: #fff; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .info-item label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.15rem; text-transform: uppercase; }
    .info-item span { font-size: 0.9rem; color: #374151; }
    .dano-section { margin-bottom: 1rem; }
    .dano-section h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; color: #374151; }
    .dano-text { background: #f9fafb; border-radius: 0.5rem; padding: 1rem; font-size: 0.9rem; color: #4b5563; line-height: 1.6; white-space: pre-wrap; }
    .ai-section { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
    .ai-section h3 { font-size: 0.875rem; font-weight: 600; color: #1e40af; margin-bottom: 0.5rem; }
    .responses-section { margin-top: 1rem; }
    .responses-section h3 { font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.75rem; }

    .form-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.5rem; }
    .form-card h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.8125rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem;
      font-size: 0.875rem; outline: none; box-sizing: border-box;
    }
    .form-group input:focus, .form-group textarea:focus { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }
    .service-selector { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
    .service-chip {
      padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; border: 1px solid #d1d5db;
      background: #fff; cursor: pointer; transition: all 0.15s;
    }
    .service-chip.selected { background: #f97316; color: #fff; border-color: #f97316; }
    .service-summary { font-size: 0.875rem; background: #f9fafb; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.75rem; }
    .service-summary strong { color: #111827; }
    .btn { font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f9fafb; color: #374151; margin-right: 0.5rem; }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; }
    .alert-error { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    .alert-success { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
    .loading { text-align: center; padding: 3rem; color: #9ca3af; }
    .ya-respondido { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 0.5rem; padding: 1rem; text-align: center; color: #065f46; font-weight: 500; }
  `]
})
export class CotizacionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CotizacionesService);
  private readonly catalogService = inject(ServiceCatalogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  cotizacion = signal<Cotizacion | null>(null);
  catalogItems = signal<CatalogItem[]>([]);
  loading = signal(true);
  enviando = signal(false);
  error = signal<string | null>(null);
  enviadoExito = signal(false);

  selectedServices: number[] = [];
  costoTotal = 0;
  tiempoTotal = 0;
  tiempoEstimadoTexto = '';
  notas = '';
  validezHoras = 48;

  readonly estadosLabels = ESTADO_COTIZACION_LABELS;
  readonly estadosColors = ESTADO_COTIZACION_COLORS;

  get yaRespondio(): boolean {
    const c = this.cotizacion();
    if (!c) return false;
    return c.respuestas.some(r => r.estado === 'pendiente');
  }

  get serviciosSeleccionados(): ServicioCotizado[] {
    return this.selectedServices.map(id => {
      const item = this.catalogItems().find(i => i.servicio_id === id);
      return {
        servicio_id: id,
        nombre: item?.servicio_nombre ?? '',
        precio: item?.precio ?? 0,
        tiempo_minutos: item?.tiempo_estimado_min ?? 0,
      };
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadCotizacion(id);
      this.loadCatalog();
    } else {
      this.router.navigate(['/workshop/cotizaciones']);
    }
  }

  loadCotizacion(id: number): void {
    this.loading.set(true);
    this.service.getCotizacionTallerDetalle(id).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.cotizacion.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Error al cargar la cotizacion');
      },
    });
  }

  loadCatalog(): void {
    this.catalogService.getCatalog().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => this.catalogItems.set(items.filter(i => i.is_active)),
    });
  }

  toggleService(id: number): void {
    const idx = this.selectedServices.indexOf(id);
    if (idx >= 0) {
      this.selectedServices.splice(idx, 1);
    } else {
      this.selectedServices.push(id);
    }
    this.recalcular();
  }

  recalcular(): void {
    let costo = 0;
    let tiempo = 0;
    for (const id of this.selectedServices) {
      const item = this.catalogItems().find(i => i.servicio_id === id);
      if (item) {
        costo += item.precio ?? 0;
        tiempo += item.tiempo_estimado_min ?? 0;
      }
    }
    this.costoTotal = costo;
    this.tiempoTotal = tiempo;

    if (tiempo <= 60) this.tiempoEstimadoTexto = '1 hora';
    else if (tiempo <= 120) this.tiempoEstimadoTexto = '1-2 horas';
    else if (tiempo <= 480) this.tiempoEstimadoTexto = `${Math.ceil(tiempo / 60)} horas`;
    else this.tiempoEstimadoTexto = `${Math.ceil(tiempo / 480)} dias habiles`;
  }

  enviarRespuesta(): void {
    const id = this.cotizacion()?.id;
    if (!id) return;
    if (this.selectedServices.length === 0) {
      this.toast.error('Selecciona al menos un servicio');
      return;
    }

    this.enviando.set(true);
    this.service.responderCotizacion(id, {
      servicios: this.serviciosSeleccionados,
      costo_total: this.costoTotal,
      tiempo_estimado_minutos: this.tiempoTotal,
      tiempo_estimado_texto: this.tiempoEstimadoTexto || 'Por definir',
      notas: this.notas || undefined,
      validez_horas: this.validezHoras,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviadoExito.set(true);
        this.toast.success('Cotizacion enviada exitosamente');
        this.loadCotizacion(id);
      },
      error: (err) => {
        this.enviando.set(false);
        this.toast.error(err.error?.detail || 'Error al enviar la cotizacion');
      },
    });
  }
}
