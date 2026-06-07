import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CotizacionesService } from '../../core/services/cotizaciones.service';
import { ToastService } from '../../core/services/toast.service';
import { Cotizacion, CotizacionListItem, ESTADO_COTIZACION_LABELS, ESTADO_COTIZACION_COLORS } from '../../core/models/cotizacion.model';

@Component({
  selector: 'app-cotizaciones-cliente',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cotizaciones-cliente.html',
  styles: [`
    .container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 1.5rem; }
    .header h1 { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .tabs { display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 1.5rem; }
    .tab { padding: 0.75rem 1.25rem; font-size: 0.9rem; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-weight: 500; }
    .tab.active { color: #f97316; border-bottom-color: #f97316; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 1rem; max-width: 800px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; cursor: pointer; transition: box-shadow 0.2s; }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .card.selected { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .card-title { font-size: 1rem; font-weight: 600; color: #111827; }
    .badge { font-size: 0.7rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 500; color: #fff; }
    .card-body { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.75rem; }
    .respuesta-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.5rem; }
    .respuesta-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .respuesta-workshop { font-weight: 600; font-size: 0.95rem; }
    .respuesta-precio { font-size: 1.1rem; font-weight: 700; color: #f97316; }
    .respuesta-tiempo { font-size: 0.8rem; color: #6b7280; }
    .btn { font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid #d1d5db; background: #fff; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-success { background: #10b981; color: #fff; border-color: #10b981; font-weight: 600; }
    .btn-success:hover { background: #059669; }
    .btn-danger { color: #dc2626; border-color: #fca5a5; }
    .actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
    .loading { text-align: center; padding: 3rem; color: #9ca3af; }
    .empty { text-align: center; padding: 3rem; color: #6b7280; }
    .alert { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; }
    .alert-success { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
    .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    .detail-section { margin-top: 1.5rem; }
    .detail-section h3 { font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 0.75rem; }
    .incidente-link { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #f97316; text-decoration: none; font-weight: 500; padding: 0.5rem 0; }
  `]
})
export class CotizacionesClienteComponent implements OnInit {
  private readonly service = inject(CotizacionesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  cotizaciones = signal<CotizacionListItem[]>([]);
  loading = signal(true);
  tabActiva = signal<'lista' | 'nueva'>('lista');

  detalleLoading = signal(false);
  cotizacionSeleccionada = signal<Cotizacion | null>(null);
  respuestaSeleccionadaId = signal<number | null>(null);
  seleccionando = signal(false);
  incidenteId = signal<number | null>(null);

  readonly estadosLabels = ESTADO_COTIZACION_LABELS;
  readonly estadosColors = ESTADO_COTIZACION_COLORS;

  ngOnInit(): void {
    this.loadCotizaciones();
  }

  loadCotizaciones(): void {
    this.loading.set(true);
    this.service.getCotizacionesCliente().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.cotizaciones.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error al cargar cotizaciones');
      },
    });
  }

  verDetalle(id: number): void {
    this.detalleLoading.set(true);
    this.incidenteId.set(null);
    this.service.getCotizacionDetalle(id).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.cotizacionSeleccionada.set(data);
        this.detalleLoading.set(false);
      },
      error: () => {
        this.detalleLoading.set(false);
        this.toast.error('Error al cargar detalle');
      },
    });
  }

  seleccionarRespuesta(respuestaId: number): void {
    this.respuestaSeleccionadaId.set(respuestaId);
  }

  confirmarSeleccion(): void {
    const c = this.cotizacionSeleccionada();
    const rid = this.respuestaSeleccionadaId();
    if (!c || !rid) return;

    this.seleccionando.set(true);
    this.service.seleccionarTaller(c.id, rid).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data: Record<string, unknown>) => {
        this.seleccionando.set(false);
        const iid = data['incidente_id'] as number;
        if (iid) {
          this.incidenteId.set(iid);
          this.toast.success('Taller seleccionado. Se ha creado un incidente para seguimiento.');
        } else {
          this.toast.success('Taller seleccionado exitosamente');
        }
        this.verDetalle(c.id);
      },
      error: (err) => {
        this.seleccionando.set(false);
        this.toast.error(err.error?.detail || 'Error al seleccionar taller');
      },
    });
  }

  verIncidente(id: number): void {
    this.router.navigate(['/workshop/incidents', id]);
  }

  cancelar(id: number): void {
    this.service.cancelarCotizacion(id).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.toast.info('Cotizacion cancelada');
        this.loadCotizaciones();
        this.cotizacionSeleccionada.set(null);
      },
      error: (err) => this.toast.error(err.error?.detail || 'Error al cancelar'),
    });
  }
}
