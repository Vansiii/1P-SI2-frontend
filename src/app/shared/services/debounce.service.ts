import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

/**
 * DebounceService
 * 
 * Service for debouncing user inputs to improve performance
 * and reduce unnecessary API calls or state updates.
 * 
 * Features:
 * - Configurable debounce delay
 * - Distinct until changed to prevent duplicate emissions
 * - Generic type support for different input types
 * 
 * Requirements: 11.5
 */
@Injectable({
  providedIn: 'root'
})
export class DebounceService {
  private subjects = new Map<string, Subject<any>>();

  /**
   * Create a debounced observable for a specific key
   * @param key Unique identifier for the debounced stream
   * @param delayMs Debounce delay in milliseconds (default: 300ms)
   * @returns Observable that emits debounced values
   */
  createDebouncedObservable<T>(key: string, delayMs: number = 300): {
    input$: Subject<T>;
    output$: Observable<T>;
  } {
    if (!this.subjects.has(key)) {
      this.subjects.set(key, new Subject<T>());
    }

    const input$ = this.subjects.get(key) as Subject<T>;
    const output$ = input$.pipe(
      debounceTime(delayMs),
      distinctUntilChanged()
    );

    return { input$, output$ };
  }

  /**
   * Emit a value to a debounced stream
   * @param key Stream identifier
   * @param value Value to emit
   */
  emit<T>(key: string, value: T): void {
    const subject = this.subjects.get(key);
    if (subject) {
      subject.next(value);
    }
  }

  /**
   * Clean up a debounced stream
   * @param key Stream identifier
   */
  cleanup(key: string): void {
    const subject = this.subjects.get(key);
    if (subject) {
      subject.complete();
      this.subjects.delete(key);
    }
  }

  /**
   * Clean up all debounced streams
   */
  cleanupAll(): void {
    this.subjects.forEach(subject => subject.complete());
    this.subjects.clear();
  }
}