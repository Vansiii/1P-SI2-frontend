import { Directive, ElementRef, Input, OnInit, OnDestroy, inject, signal } from '@angular/core';

/**
 * LazyImageDirective
 * 
 * Directive for lazy loading images using IntersectionObserver.
 * Images are only loaded when they become visible in the viewport.
 * Shows a placeholder while loading.
 * 
 * Usage:
 * ```html
 * <img appLazyImage [src]="imageUrl" [placeholder]="placeholderUrl" alt="Description">
 * ```
 * 
 * Features:
 * - Lazy loads images when visible in viewport
 * - Shows placeholder while loading
 * - Automatically cleans up observer on destroy
 * - Handles loading errors gracefully
 * 
 * Requirements: 11.4
 */
@Directive({
  selector: 'img[appLazyImage]',
  standalone: true
})
export class LazyImageDirective implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef<HTMLImageElement>);
  private observer: IntersectionObserver | null = null;

  /**
   * The actual image source to load
   */
  @Input({ required: true }) src!: string;

  /**
   * Placeholder image to show while loading
   * Default: data URL for a gray placeholder
   */
  @Input() placeholder: string = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="%239ca3af"%3ECargando...%3C/text%3E%3C/svg%3E';

  /**
   * Loading state signal
   */
  private loading = signal<boolean>(true);

  ngOnInit(): void {
    // Set placeholder initially
    this.setPlaceholder();

    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      this.setupIntersectionObserver();
    } else {
      // Fallback: load image immediately if IntersectionObserver is not supported
      this.loadImage();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Set placeholder image
   */
  private setPlaceholder(): void {
    const img = this.elementRef.nativeElement;
    img.src = this.placeholder;
    img.classList.add('lazy-loading');
  }

  /**
   * Setup IntersectionObserver to detect when image enters viewport
   */
  private setupIntersectionObserver(): void {
    const options: IntersectionObserverInit = {
      root: null, // viewport
      rootMargin: '50px', // Start loading 50px before entering viewport
      threshold: 0.01 // Trigger when 1% of image is visible
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadImage();
          // Stop observing after loading starts
          if (this.observer) {
            this.observer.unobserve(entry.target);
          }
        }
      });
    }, options);

    this.observer.observe(this.elementRef.nativeElement);
  }

  /**
   * Load the actual image
   */
  private loadImage(): void {
    const img = this.elementRef.nativeElement;

    // Create a new image to preload
    const tempImg = new Image();

    tempImg.onload = () => {
      // Image loaded successfully
      img.src = this.src;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      this.loading.set(false);
    };

    tempImg.onerror = () => {
      // Image failed to load, show error placeholder
      console.error(`Failed to load image: ${this.src}`);
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
      this.loading.set(false);
      
      // Set error placeholder
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23fee2e2"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="%23ef4444"%3EError al cargar%3C/text%3E%3C/svg%3E';
    };

    // Start loading
    tempImg.src = this.src;
  }

  /**
   * Cleanup observer
   */
  private cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
