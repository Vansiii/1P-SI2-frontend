import { 
  Directive, 
  ElementRef, 
  HostListener, 
  Input, 
  Renderer2, 
  inject,
  OnDestroy,
  signal,
  computed
} from '@angular/core';

/**
 * TooltipDirective
 * 
 * Directive for displaying accessible tooltips on hover and focus.
 * Provides contextual information for icons, badges, and interactive elements.
 * 
 * Features:
 * - Keyboard accessible (shows on focus)
 * - Mouse accessible (shows on hover)
 * - Automatic positioning (top, bottom, left, right)
 * - ARIA compliant with describedby
 * - Customizable delay and styling
 * - Responsive positioning
 * 
 * Usage:
 * <button appTooltip="Save changes" tooltipPosition="top">Save</button>
 * <span appTooltip="High priority incident" tooltipDelay="500">🔥</span>
 * 
 * Requirements: 12.5
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  // Input properties
  @Input('appTooltip') tooltipText = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() tooltipDelay: number = 300;
  @Input() tooltipDisabled: boolean = false;

  // State
  private tooltipElement: HTMLElement | null = null;
  private showTimeout: number | null = null;
  private hideTimeout: number | null = null;
  private isVisible = signal(false);
  private uniqueId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  // Computed
  private shouldShow = computed(() => {
    return !this.tooltipDisabled && this.tooltipText.trim().length > 0;
  });

  constructor() {
    // Set up ARIA attributes
    this.renderer.setAttribute(
      this.elementRef.nativeElement,
      'aria-describedby',
      this.uniqueId
    );
  }

  ngOnDestroy(): void {
    this.clearTimeouts();
    this.hideTooltip();
  }

  /**
   * Show tooltip on mouse enter
   */
  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.shouldShow()) {
      this.scheduleShow();
    }
  }

  /**
   * Hide tooltip on mouse leave
   */
  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.scheduleHide();
  }

  /**
   * Show tooltip on focus (keyboard accessibility)
   */
  @HostListener('focus')
  onFocus(): void {
    if (this.shouldShow()) {
      this.scheduleShow();
    }
  }

  /**
   * Hide tooltip on blur
   */
  @HostListener('blur')
  onBlur(): void {
    this.scheduleHide();
  }

  /**
   * Handle escape key to hide tooltip
   */
  @HostListener('keydown.escape')
  onEscape(): void {
    this.hideTooltip();
  }

  /**
   * Schedule tooltip show with delay
   */
  private scheduleShow(): void {
    this.clearTimeouts();
    
    this.showTimeout = window.setTimeout(() => {
      this.showTooltip();
    }, this.tooltipDelay);
  }

  /**
   * Schedule tooltip hide with shorter delay
   */
  private scheduleHide(): void {
    this.clearTimeouts();
    
    this.hideTimeout = window.setTimeout(() => {
      this.hideTooltip();
    }, 100); // Shorter delay for hiding
  }

  /**
   * Show the tooltip
   */
  private showTooltip(): void {
    if (this.isVisible() || !this.shouldShow()) return;

    this.createTooltipElement();
    this.positionTooltip();
    this.isVisible.set(true);

    // Add to DOM
    document.body.appendChild(this.tooltipElement!);

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        this.tooltipElement.classList.add('tooltip-visible');
      }
    });
  }

  /**
   * Hide the tooltip
   */
  private hideTooltip(): void {
    if (!this.isVisible() || !this.tooltipElement) return;

    this.tooltipElement.classList.remove('tooltip-visible');
    
    // Wait for animation to complete before removing
    setTimeout(() => {
      if (this.tooltipElement && this.tooltipElement.parentNode) {
        this.tooltipElement.parentNode.removeChild(this.tooltipElement);
      }
      this.tooltipElement = null;
      this.isVisible.set(false);
    }, 150);
  }

  /**
   * Create tooltip element
   */
  private createTooltipElement(): void {
    this.tooltipElement = this.renderer.createElement('div');
    
    // Set content
    this.renderer.setProperty(this.tooltipElement, 'textContent', this.tooltipText);
    
    // Set attributes
    this.renderer.setAttribute(this.tooltipElement, 'id', this.uniqueId);
    this.renderer.setAttribute(this.tooltipElement, 'role', 'tooltip');
    this.renderer.setAttribute(this.tooltipElement, 'aria-hidden', 'false');
    
    // Set classes
    this.renderer.addClass(this.tooltipElement, 'tooltip');
    this.renderer.addClass(this.tooltipElement, `tooltip-${this.tooltipPosition}`);
  }

  /**
   * Position tooltip relative to host element
   */
  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    let top = 0;
    let left = 0;
    const offset = 8; // Distance from host element

    switch (this.tooltipPosition) {
      case 'top':
        top = hostRect.top + scrollY - tooltipRect.height - offset;
        left = hostRect.left + scrollX + (hostRect.width - tooltipRect.width) / 2;
        
        // Adjust if tooltip goes outside viewport
        if (top < scrollY) {
          // Switch to bottom if not enough space on top
          top = hostRect.bottom + scrollY + offset;
          this.renderer.removeClass(this.tooltipElement, 'tooltip-top');
          this.renderer.addClass(this.tooltipElement, 'tooltip-bottom');
        }
        break;

      case 'bottom':
        top = hostRect.bottom + scrollY + offset;
        left = hostRect.left + scrollX + (hostRect.width - tooltipRect.width) / 2;
        
        // Adjust if tooltip goes outside viewport
        if (top + tooltipRect.height > scrollY + viewportHeight) {
          // Switch to top if not enough space on bottom
          top = hostRect.top + scrollY - tooltipRect.height - offset;
          this.renderer.removeClass(this.tooltipElement, 'tooltip-bottom');
          this.renderer.addClass(this.tooltipElement, 'tooltip-top');
        }
        break;

      case 'left':
        top = hostRect.top + scrollY + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left + scrollX - tooltipRect.width - offset;
        
        // Adjust if tooltip goes outside viewport
        if (left < scrollX) {
          // Switch to right if not enough space on left
          left = hostRect.right + scrollX + offset;
          this.renderer.removeClass(this.tooltipElement, 'tooltip-left');
          this.renderer.addClass(this.tooltipElement, 'tooltip-right');
        }
        break;

      case 'right':
        top = hostRect.top + scrollY + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + scrollX + offset;
        
        // Adjust if tooltip goes outside viewport
        if (left + tooltipRect.width > scrollX + viewportWidth) {
          // Switch to left if not enough space on right
          left = hostRect.left + scrollX - tooltipRect.width - offset;
          this.renderer.removeClass(this.tooltipElement, 'tooltip-right');
          this.renderer.addClass(this.tooltipElement, 'tooltip-left');
        }
        break;
    }

    // Ensure tooltip doesn't go outside viewport horizontally
    if (left < scrollX) {
      left = scrollX + 8;
    } else if (left + tooltipRect.width > scrollX + viewportWidth) {
      left = scrollX + viewportWidth - tooltipRect.width - 8;
    }

    // Ensure tooltip doesn't go outside viewport vertically
    if (top < scrollY) {
      top = scrollY + 8;
    } else if (top + tooltipRect.height > scrollY + viewportHeight) {
      top = scrollY + viewportHeight - tooltipRect.height - 8;
    }

    // Apply position
    this.renderer.setStyle(this.tooltipElement, 'position', 'absolute');
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
    this.renderer.setStyle(this.tooltipElement, 'z-index', '9999');
  }

  /**
   * Clear all timeouts
   */
  private clearTimeouts(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}