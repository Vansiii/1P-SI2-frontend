import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for getting estado label
 * Usage: {{ estado | estadoLabel }}
 */
@Pipe({
  name: 'estadoLabel',
  standalone: true,
  pure: true // Pure pipe for better performance
})
export class EstadoLabelPipe implements PipeTransform {
  private readonly estadoLabels: Record<string, string> = {
    'pendiente': 'Pendiente',
    'asignado': 'Asignado',
    'en_proceso': 'En Proceso',
    'resuelto': 'Resuelto',
    'cancelado': 'Cancelado',
    'sin_taller_disponible': 'Sin Taller Disponible'
  };

  transform(estado: string | null | undefined): string {
    if (!estado) return '';
    return this.estadoLabels[estado] || estado;
  }
}

/**
 * Pure pipe for getting estado color class
 * Usage: {{ estado | estadoColor }}
 */
@Pipe({
  name: 'estadoColor',
  standalone: true,
  pure: true
})
export class EstadoColorPipe implements PipeTransform {
  private readonly estadoColors: Record<string, string> = {
    'pendiente': 'warning',
    'asignado': 'info',
    'en_proceso': 'primary',
    'resuelto': 'success',
    'cancelado': 'danger',
    'sin_taller_disponible': 'danger'
  };

  transform(estado: string | null | undefined): string {
    if (!estado) return 'default';
    return this.estadoColors[estado] || 'default';
  }
}
