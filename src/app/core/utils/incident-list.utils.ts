/**
 * Incident List Utilities
 * 
 * Pure functions for immutable incident list manipulation.
 * These functions ensure data integrity and prevent accidental mutations.
 * 
 * @module IncidentListUtils
 */

import { Incident } from '../models/incident.model';

// Legacy incident type for backward compatibility
export interface LegacyIncident {
  id: number;
  cliente_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  estado_actual: string;
  estado_label: string;
  descripcion: string;
  latitud: number;
  longitud: number;
  direccion_referencia: string | null;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  prioridad_label: string;
  created_at: string;
  updated_at: string;
  cliente?: any;
  vehiculo?: any;
  [key: string]: any; // Allow additional fields
}

/**
 * Upsert an incident in the list (add if new, update if exists)
 * 
 * @param incidents Current list of incidents
 * @param updated Incident data to upsert (must include id)
 * @returns New array with incident upserted
 * 
 * @example
 * const incidents = [{ id: 1, description: 'A' }, { id: 2, description: 'B' }];
 * const result = upsertIncident(incidents, { id: 3, description: 'C' });
 * // result: [{ id: 1, ... }, { id: 2, ... }, { id: 3, description: 'C' }]
 */
export function upsertIncident<T extends Record<string, any>>(
  incidents: T[],
  updated: Partial<T> & { id: number }
): T[] {
  const index = incidents.findIndex(inc => inc['id'] === updated.id);
  
  if (index === -1) {
    // Add new incident
    console.log('[IncidentUtils] Adding new incident:', updated.id);
    return [...incidents, updated as unknown as T];
  }
  
  // Update existing incident with safe merge
  console.log('[IncidentUtils] Updating existing incident:', updated.id);
  return incidents.map((inc, i) =>
    i === index ? safeIncidentMerge(inc, updated) : inc
  );
}

/**
 * Safely merge incident updates preserving critical fields
 * 
 * This function ensures that important fields like AI recommendations
 * are not lost when merging partial updates.
 * 
 * Works with both Incident and LegacyIncident types.
 * 
 * @param current Current incident data
 * @param updates Partial updates to apply
 * @returns Merged incident with preserved critical fields
 * 
 * @example
 * const current = { id: 1, description: 'A', aiRecommendation: { workshopId: 'w1' } };
 * const updates = { description: 'A Updated' };
 * const result = safeIncidentMerge(current, updates);
 * // result: { id: 1, description: 'A Updated', aiRecommendation: { workshopId: 'w1' } }
 */
export function safeIncidentMerge<T extends Record<string, any>>(
  current: T,
  updates: Partial<T>
): T {
  // List of critical fields that should be preserved if not in updates
  const criticalFields = [
    'suggested_technician',
    'ai_analysis',
    'ai_recommendation',
    'categoria_ia',
    'prioridad_ia',
    'resumen_ia'
  ];
  
  // Start with current data, apply updates
  const merged: any = { ...current, ...updates };
  
  // Preserve critical fields if they're not explicitly updated
  criticalFields.forEach(field => {
    if (updates[field] === undefined && current[field] !== undefined) {
      merged[field] = current[field];
    }
  });
  
  // Special handling for estado (status) - don't allow ASSIGNED without confirmation
  if (updates['estado_actual'] === 'asignado' && !updates['taller_id']) {
    console.warn('[IncidentUtils] Attempted to set estado to "asignado" without taller_id');
    merged['estado_actual'] = current['estado_actual'];
  }
  
  // Update timestamp
  merged['updated_at'] = new Date().toISOString();
  
  return merged as T;
}

/**
 * Remove an incident from the list
 * 
 * @param incidents Current list of incidents
 * @param incidentId ID of incident to remove
 * @returns New array without the specified incident
 * 
 * @example
 * const incidents = [{ id: 1, ... }, { id: 2, ... }, { id: 3, ... }];
 * const result = removeIncident(incidents, 2);
 * // result: [{ id: 1, ... }, { id: 3, ... }]
 */
export function removeIncident<T extends Record<string, any>>(
  incidents: T[],
  incidentId: number
): T[] {
  const filtered = incidents.filter(inc => inc['id'] !== incidentId);
  
  if (filtered.length === incidents.length) {
    console.warn('[IncidentUtils] Incident not found for removal:', incidentId);
  } else {
    console.log('[IncidentUtils] Removed incident:', incidentId);
  }
  
  return filtered;
}

/**
 * Remove incidents by workshop ID
 * 
 * Useful when a workshop rejects or when incidents are reassigned.
 * 
 * @param incidents Current list of incidents
 * @param workshopId ID of workshop whose incidents should be removed
 * @returns New array without incidents from specified workshop
 * 
 * @example
 * const incidents = [
 *   { id: 1, taller_id: 10 },
 *   { id: 2, taller_id: 20 },
 *   { id: 3, taller_id: 10 }
 * ];
 * const result = removeIncidentsByWorkshop(incidents, 10);
 * // result: [{ id: 2, taller_id: 20 }]
 */
export function removeIncidentsByWorkshop<T extends Record<string, any>>(
  incidents: T[],
  workshopId: number
): T[] {
  const filtered = incidents.filter(inc => inc['taller_id'] !== workshopId);
  
  const removedCount = incidents.length - filtered.length;
  if (removedCount > 0) {
    console.log(`[IncidentUtils] Removed ${removedCount} incidents from workshop:`, workshopId);
  }
  
  return filtered;
}

/**
 * Remove incidents by status
 * 
 * @param incidents Current list of incidents
 * @param status Status of incidents to remove
 * @returns New array without incidents of specified status
 */
export function removeIncidentsByStatus<T extends Record<string, any>>(
  incidents: T[],
  status: string
): T[] {
  return incidents.filter(inc => inc['estado'] !== status && inc['estado_actual'] !== status);
}

/**
 * Update incident status with validation
 * 
 * @param incidents Current list of incidents
 * @param incidentId ID of incident to update
 * @param newStatus New status to set
 * @param context Additional context for validation (e.g., assignedAt)
 * @returns New array with updated incident, or original if validation fails
 */
export function updateIncidentStatus<T extends Record<string, any>>(
  incidents: T[],
  incidentId: number,
  newStatus: string,
  context?: { taller_id?: number; tecnico_id?: number; assigned_at?: string }
): T[] {
  const incident = incidents.find(inc => inc['id'] === incidentId);
  
  if (!incident) {
    console.warn('[IncidentUtils] Incident not found for status update:', incidentId);
    return incidents;
  }
  
  // Validate status transition
  if (newStatus === 'asignado' && !context?.assigned_at) {
    console.error('[IncidentUtils] Cannot set status to "asignado" without assigned_at');
    return incidents;
  }
  
  // Apply update
  return upsertIncident(incidents, {
    id: incidentId,
    estado: newStatus,
    estado_actual: newStatus,
    ...context
  } as any);
}

/**
 * Batch upsert multiple incidents
 * 
 * More efficient than calling upsertIncident multiple times.
 * 
 * @param incidents Current list of incidents
 * @param updates Array of incident updates
 * @returns New array with all updates applied
 */
export function batchUpsertIncidents<T extends Record<string, any>>(
  incidents: T[],
  updates: Array<Partial<T> & { id: number }>
): T[] {
  let result = incidents;
  
  updates.forEach(update => {
    result = upsertIncident(result, update);
  });
  
  return result;
}

/**
 * Check if incident exists in list
 * 
 * @param incidents List of incidents
 * @param incidentId ID to check
 * @returns true if incident exists, false otherwise
 */
export function hasIncident<T extends Record<string, any>>(
  incidents: T[],
  incidentId: number
): boolean {
  return incidents.some(inc => inc['id'] === incidentId);
}

/**
 * Get incident by ID
 * 
 * @param incidents List of incidents
 * @param incidentId ID to find
 * @returns Incident if found, undefined otherwise
 */
export function getIncidentById<T extends Record<string, any>>(
  incidents: T[],
  incidentId: number
): T | undefined {
  return incidents.find(inc => inc['id'] === incidentId);
}

/**
 * Sort incidents by priority and date
 * 
 * @param incidents List of incidents to sort
 * @returns New sorted array
 */
export function sortIncidents<T extends Record<string, any>>(
  incidents: T[]
): T[] {
  return [...incidents].sort((a, b) => {
    // First by priority
    const priorityOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
    const aPriority = priorityOrder[a['prioridad'] || a['prioridad_ia']] ?? 3;
    const bPriority = priorityOrder[b['prioridad'] || b['prioridad_ia']] ?? 3;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Then by creation date (newest first)
    return new Date(b['created_at']).getTime() - new Date(a['created_at']).getTime();
  });
}
