import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * KeyboardNavigationService
 * 
 * Service for detecting and managing keyboard navigation state.
 * Helps differentiate between keyboard and mouse navigation for better UX.
 * 
 * Features:
 * - Detects keyboard navigation (Tab key)
 * - Detects mouse navigation (click)
 * - Adds body classes for CSS targeting
 * - Improves focus visible behavior
 * 
 * Requirements: 12.6
 */
@Injectable({
  providedIn: 'root'
})
export class KeyboardNavigationService {
  private platformId = inject(PLATFORM_ID);
  private isKeyboardUser = false;
  private isInitialized = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initialize();
    }
  }

  /**
   * Initialize keyboard navigation detection
   */
  private initialize(): void {
    if (this.isInitialized) return;

    // Detect Tab key press
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        this.setKeyboardNavigation(true);
      }
    });

    // Detect mouse click
    document.addEventListener('mousedown', () => {
      this.setKeyboardNavigation(false);
    });

    // Detect touch
    document.addEventListener('touchstart', () => {
      this.setKeyboardNavigation(false);
    });

    this.isInitialized = true;
  }

  /**
   * Set keyboard navigation state
   */
  private setKeyboardNavigation(isKeyboard: boolean): void {
    if (this.isKeyboardUser === isKeyboard) return;

    this.isKeyboardUser = isKeyboard;

    if (isKeyboard) {
      document.body.classList.add('using-keyboard');
      document.body.classList.remove('using-mouse');
    } else {
      document.body.classList.add('using-mouse');
      document.body.classList.remove('using-keyboard');
    }
  }

  /**
   * Check if user is navigating with keyboard
   */
  isUsingKeyboard(): boolean {
    return this.isKeyboardUser;
  }

  /**
   * Focus first focusable element in container
   */
  focusFirstElement(container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  /**
   * Focus last focusable element in container
   */
  focusLastElement(container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
    }
  }

  /**
   * Get all focusable elements in container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Trap focus within container (for modals)
   */
  trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus first element
    firstElement.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Create skip link for accessibility
   */
  createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLAnchorElement {
    const skipLink = document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.className = 'skip-link';
    skipLink.textContent = text;
    skipLink.setAttribute('aria-label', text);

    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    return skipLink;
  }

  /**
   * Announce to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}