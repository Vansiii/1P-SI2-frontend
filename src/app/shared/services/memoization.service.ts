import { Injectable } from '@angular/core';

/**
 * MemoizationService
 * 
 * Service for memoizing expensive computations to improve performance.
 * Provides caching mechanisms for computed signals and other expensive operations.
 * 
 * Features:
 * - LRU cache with configurable size limits
 * - TTL (Time To Live) support for cache entries
 * - Generic type support
 * - Memory-efficient cleanup
 * 
 * Requirements: 11.6, 11.9
 */
@Injectable({
  providedIn: 'root'
})
export class MemoizationService {
  private caches = new Map<string, Map<string, CacheEntry<any>>>();
  private readonly DEFAULT_MAX_SIZE = 100;
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a memoized function
   * @param key Unique cache identifier
   * @param fn Function to memoize
   * @param options Cache configuration options
   * @returns Memoized function
   */
  memoize<TArgs extends any[], TReturn>(
    key: string,
    fn: (...args: TArgs) => TReturn,
    options: MemoizeOptions = {}
  ): (...args: TArgs) => TReturn {
    const {
      maxSize = this.DEFAULT_MAX_SIZE,
      ttlMs = this.DEFAULT_TTL_MS,
      keyGenerator = this.defaultKeyGenerator
    } = options;

    if (!this.caches.has(key)) {
      this.caches.set(key, new Map());
    }

    const cache = this.caches.get(key)!;

    return (...args: TArgs): TReturn => {
      const cacheKey = keyGenerator(args);
      const now = Date.now();

      // Check if we have a valid cached result
      const cached = cache.get(cacheKey);
      if (cached && (cached.expiresAt === null || cached.expiresAt > now)) {
        // Move to end for LRU
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);
        return cached.value;
      }

      // Compute new result
      const result = fn(...args);

      // Clean up expired entries and enforce size limit
      this.cleanupCache(cache, now);
      if (cache.size >= maxSize) {
        // Remove oldest entry (LRU)
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }

      // Store new result
      const expiresAt = ttlMs > 0 ? now + ttlMs : null;
      cache.set(cacheKey, { value: result, expiresAt });

      return result;
    };
  }

  /**
   * Memoize a computation with array dependencies
   * Useful for computed signals that depend on arrays
   */
  memoizeArrayComputation<T, R>(
    key: string,
    array: T[],
    computeFn: (array: T[]) => R,
    options: MemoizeOptions = {}
  ): R {
    const memoizedFn = this.memoize(
      key,
      computeFn,
      {
        ...options,
        keyGenerator: (args) => this.arrayKeyGenerator(args[0] as T[])
      }
    );

    return memoizedFn(array);
  }

  /**
   * Clear a specific cache
   */
  clearCache(key: string): void {
    this.caches.delete(key);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.caches.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(key: string): CacheStats | null {
    const cache = this.caches.get(key);
    if (!cache) return null;

    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of cache.values()) {
      if (entry.expiresAt === null || entry.expiresAt > now) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: cache.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Default key generator for function arguments
   */
  private defaultKeyGenerator(args: any[]): string {
    return JSON.stringify(args);
  }

  /**
   * Specialized key generator for arrays
   * Uses array length and hash of first/last elements for performance
   */
  private arrayKeyGenerator<T>(array: T[]): string {
    if (array.length === 0) return 'empty';
    if (array.length === 1) return `single:${JSON.stringify(array[0])}`;
    
    // For larger arrays, use length + hash of first and last elements
    const first = JSON.stringify(array[0]);
    const last = JSON.stringify(array[array.length - 1]);
    return `${array.length}:${first}:${last}`;
  }

  /**
   * Clean up expired entries from cache
   */
  private cleanupCache<T>(cache: Map<string, CacheEntry<T>>, now: number): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => cache.delete(key));
  }
}

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Memoization options
 */
export interface MemoizeOptions {
  maxSize?: number;
  ttlMs?: number;
  keyGenerator?: (args: any[]) => string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
}