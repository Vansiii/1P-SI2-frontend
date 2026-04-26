/**
 * Pure pipes for performance optimization
 * All pipes are standalone and pure for better performance
 */

export { TruncatePipe } from './truncate.pipe';
export { FormatDatePipe } from './format-date.pipe';
export { FormatTimePipe } from './format-time.pipe';
export { EstadoLabelPipe, EstadoColorPipe } from './estado-label.pipe';
export { PrioridadLabelPipe, PrioridadColorPipe } from './prioridad-label.pipe';

import { TruncatePipe } from './truncate.pipe';
import { FormatDatePipe } from './format-date.pipe';
import { FormatTimePipe } from './format-time.pipe';
import { EstadoLabelPipe, EstadoColorPipe } from './estado-label.pipe';
import { PrioridadLabelPipe, PrioridadColorPipe } from './prioridad-label.pipe';

/**
 * Array of all pipes for easy import in components
 */
export const SHARED_PIPES = [
  TruncatePipe,
  FormatDatePipe,
  FormatTimePipe,
  EstadoLabelPipe,
  EstadoColorPipe,
  PrioridadLabelPipe,
  PrioridadColorPipe
] as const;
