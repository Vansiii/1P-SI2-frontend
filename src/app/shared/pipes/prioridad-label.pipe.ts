import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for getting prioridad label
 * Usage: {{ prioridad | prioridadLabel }}
 */
@Pipe({
  name: 'prioridadLabel',
  standalone: true,
  pure: true // Pure pipe for better performance
})
export class PrioridadLabelPipe implements PipeTransform {
  private readonly prioridadLabels: Record<string, string> = {
    'baja': 'Baja',
    'media': 'Media',
    'alta': 'Alta',
    'critica': 'Crítica',
    'urgente': 'Urgente'
  };

  transform(prioridad: string | null | undefined): string {
    if (!prioridad) return '';
    return this.prioridadLabels[prioridad.toLowerCase()] || prioridad;
  }
}

/**
 * Pure pipe for getting prioridad color class
 * Usage: {{ prioridad | prioridadColor }}
 */
@Pipe({
  name: 'prioridadColor',
  standalone: true,
  pure: true
})
export class PrioridadColorPipe implements PipeTransform {
  private readonly prioridadColors: Record<string, string> = {
    'baja': 'success',
    'media': 'info',
    'alta': 'warning',
    'critica': 'danger',
    'urgente': 'danger'
  };

  transform(prioridad: string | null | undefined): string {
    if (!prioridad) return 'default';
    return this.prioridadColors[prioridad.toLowerCase()] || 'default';
  }
}
