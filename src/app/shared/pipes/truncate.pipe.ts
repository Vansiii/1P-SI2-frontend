import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for truncating text
 * Usage: {{ text | truncate:100 }}
 */
@Pipe({
  name: 'truncate',
  standalone: true,
  pure: true // Pure pipe for better performance
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, limit: number = 50, ellipsis: string = '...'): string {
    if (!value) return '';
    if (value.length <= limit) return value;
    return value.substring(0, limit).trim() + ellipsis;
  }
}
