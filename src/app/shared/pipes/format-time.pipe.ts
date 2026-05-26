import { Pipe, PipeTransform } from '@angular/core';

/**
 * Impure pipe for relative time display that updates in real time.
 * Usage: {{ date | formatTime }}
 */
@Pipe({
  name: 'formatTime',
  standalone: true,
  pure: false
})
export class FormatTimePipe implements PipeTransform {
  transform(dateString: string | null | undefined): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffMins = Math.floor(diff / 60000);
    const diffHours = Math.floor(diff / 3600000);
    const diffDays = Math.floor(diff / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
