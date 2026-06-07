import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CotizacionesService } from '../../../core/services/cotizaciones.service';
import { CotizacionesRealtimeService, CotizacionUpdate } from '../../../core/services/cotizaciones-realtime.service';
import { ToastService } from '../../../core/services/toast.service';
import { CotizacionListItem, ESTADO_COTIZACION_LABELS, ESTADO_COTIZACION_COLORS } from '../../../core/models/cotizacion.model';

@Component({
  selector: 'app-cotizaciones-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cotizaciones-list.html',
  styles: [`
    .container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .header h1 { font-size: 1.5rem; font-weight: 700; color: #111827; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1rem; }
    .card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem;
      padding: 1.25rem; cursor: pointer; transition: box-shadow 0.2s;
    }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
    .card-title { font-size: 0.95rem; font-weight: 600; color: #111827; }
    .badge { font-size: 0.7rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 500; color: #fff; }
    .badge-respondido { font-size: 0.7rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 500; background: #ecfdf5; color: #065f46; }
    .card-body { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.75rem; line-height: 1.5; }
    .card-body .dano { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #9ca3af; }
    .card-footer .distance { color: #f97316; font-weight: 500; }
    .card-meta { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .card-meta span { display: flex; align-items: center; gap: 0.25rem; }
    .loading { text-align: center; padding: 3rem; color: #9ca3af; }
    .empty { text-align: center; padding: 3rem; color: #6b7280; }
    .empty h3 { font-size: 1.15rem; color: #374151; margin-bottom: 0.5rem; }
    .filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .filter-btn { font-size: 0.8125rem; padding: 0.4rem 0.75rem; border-radius: 9999px; border: 1px solid #d1d5db; background: #fff; color: #6b7280; cursor: pointer; }
    .filter-btn.active { background: #f97316; color: #fff; border-color: #f97316; }
  `]
})
export class CotizacionesListComponent implements OnInit {
  private readonly service = inject(CotizacionesService);
  private readonly realtime = inject(CotizacionesRealtimeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  cotizaciones = signal<CotizacionListItem[]>([]);
  loading = signal(true);
  estadoFilter = signal<string>('todas');

  readonly estadosLabels = ESTADO_COTIZACION_LABELS;
  readonly estadosColors = ESTADO_COTIZACION_COLORS;

  ngOnInit(): void {
    this.loadCotizaciones();
    this.realtime.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((update: CotizacionUpdate) => {
        if (update.updateType === 'solicitada') {
          this.toast.info('Nueva solicitud de cotizacion recibida');
          this.loadCotizaciones();
        }
      });
  }

  loadCotizaciones(): void {
    this.loading.set(true);
    this.service.getCotizacionesTaller().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.cotizaciones.set(data);
        this.loading.set(false);
      },
      error: (_err: unknown) => {
        this.loading.set(false);
        this.toast.error('Error al cargar cotizaciones');
      },
    });
  }

  get filtered(): CotizacionListItem[] {
    const items = this.cotizaciones();
    const filter = this.estadoFilter();
    if (filter === 'todas') return items;
    if (filter === 'pendientes') return items.filter(c => !c.ya_respondio);
    if (filter === 'respondidas') return items.filter(c => c.ya_respondio);
    return items;
  }

  setFilter(f: string): void {
    this.estadoFilter.set(f);
  }

  verDetalle(id: number): void {
    this.router.navigate(['/workshop/cotizaciones', id]);
  }
}
