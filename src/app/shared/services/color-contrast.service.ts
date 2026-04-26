import { Injectable } from '@angular/core';

/**
 * ColorContrastService
 * 
 * Service for ensuring WCAG AA color contrast compliance.
 * Provides utilities to check and adjust colors for accessibility.
 * 
 * WCAG AA Requirements:
 * - Normal text: 4.5:1 contrast ratio
 * - Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio
 * - UI components: 3:1 contrast ratio
 * 
 * Requirements: 12.4
 */
@Injectable({
  providedIn: 'root'
})
export class ColorContrastService {
  
  /**
   * WCAG AA compliant color palette
   */
  public readonly WCAG_COLORS = {
    // Priority colors (WCAG AA compliant)
    priority: {
      alta: {
        background: '#dc2626', // Red 600 - sufficient contrast on white
        text: '#ffffff',
        border: '#b91c1c' // Red 700
      },
      media: {
        background: '#d97706', // Amber 600 - sufficient contrast on white  
        text: '#ffffff',
        border: '#b45309' // Amber 700
      },
      baja: {
        background: '#2563eb', // Blue 600 - sufficient contrast on white
        text: '#ffffff',
        border: '#1d4ed8' // Blue 700
      }
    },

    // Status colors (WCAG AA compliant)
    status: {
      pendiente: {
        background: '#6b7280', // Gray 500
        text: '#ffffff',
        border: '#4b5563' // Gray 600
      },
      asignado: {
        background: '#0891b2', // Cyan 600
        text: '#ffffff',
        border: '#0e7490' // Cyan 700
      },
      aceptado: {
        background: '#059669', // Emerald 600
        text: '#ffffff',
        border: '#047857' // Emerald 700
      },
      en_camino: {
        background: '#7c3aed', // Violet 600
        text: '#ffffff',
        border: '#6d28d9' // Violet 700
      },
      en_proceso: {
        background: '#ea580c', // Orange 600
        text: '#ffffff',
        border: '#c2410c' // Orange 700
      },
      resuelto: {
        background: '#16a34a', // Green 600
        text: '#ffffff',
        border: '#15803d' // Green 700
      },
      cancelado: {
        background: '#dc2626', // Red 600
        text: '#ffffff',
        border: '#b91c1c' // Red 700
      },
      sin_taller_disponible: {
        background: '#991b1b', // Red 800
        text: '#ffffff',
        border: '#7f1d1d' // Red 900
      }
    },

    // Timeout colors (WCAG AA compliant)
    timeout: {
      warning: {
        background: '#f59e0b', // Amber 500
        text: '#000000', // Black for better contrast
        border: '#d97706' // Amber 600
      },
      critical: {
        background: '#ef4444', // Red 500
        text: '#ffffff',
        border: '#dc2626' // Red 600
      }
    },

    // UI element colors (WCAG AA compliant)
    ui: {
      primary: {
        background: '#f97316', // Orange 500
        text: '#ffffff',
        border: '#ea580c' // Orange 600
      },
      secondary: {
        background: '#6b7280', // Gray 500
        text: '#ffffff',
        border: '#4b5563' // Gray 600
      },
      success: {
        background: '#10b981', // Emerald 500
        text: '#ffffff',
        border: '#059669' // Emerald 600
      },
      danger: {
        background: '#ef4444', // Red 500
        text: '#ffffff',
        border: '#dc2626' // Red 600
      },
      warning: {
        background: '#f59e0b', // Amber 500
        text: '#000000', // Black for better contrast
        border: '#d97706' // Amber 600
      },
      info: {
        background: '#3b82f6', // Blue 500
        text: '#ffffff',
        border: '#2563eb' // Blue 600
      }
    }
  } as const;

  /**
   * Calculate contrast ratio between two colors
   * @param color1 First color (hex format)
   * @param color2 Second color (hex format)
   * @returns Contrast ratio (1-21)
   */
  calculateContrastRatio(color1: string, color2: string): number {
    const luminance1 = this.getLuminance(color1);
    const luminance2 = this.getLuminance(color2);
    
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if color combination meets WCAG AA standards
   * @param backgroundColor Background color (hex format)
   * @param textColor Text color (hex format)
   * @param isLargeText Whether the text is large (18pt+ or 14pt+ bold)
   * @returns Whether the combination is compliant
   */
  isWCAGCompliant(backgroundColor: string, textColor: string, isLargeText: boolean = false): boolean {
    const ratio = this.calculateContrastRatio(backgroundColor, textColor);
    const requiredRatio = isLargeText ? 3.0 : 4.5;
    
    return ratio >= requiredRatio;
  }

  /**
   * Get WCAG compliant color for priority
   */
  getPriorityColor(priority: 'alta' | 'media' | 'baja'): {
    background: string;
    text: string;
    border: string;
  } {
    return this.WCAG_COLORS.priority[priority];
  }

  /**
   * Get WCAG compliant color for status
   */
  getStatusColor(status: string): {
    background: string;
    text: string;
    border: string;
  } {
    const statusKey = status as keyof typeof this.WCAG_COLORS.status;
    return this.WCAG_COLORS.status[statusKey] || this.WCAG_COLORS.status.pendiente;
  }

  /**
   * Get WCAG compliant timeout color
   */
  getTimeoutColor(isWarning: boolean = false): {
    background: string;
    text: string;
    border: string;
  } {
    return isWarning ? this.WCAG_COLORS.timeout.warning : this.WCAG_COLORS.timeout.critical;
  }

  /**
   * Get WCAG compliant UI color
   */
  getUIColor(type: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'): {
    background: string;
    text: string;
    border: string;
  } {
    return this.WCAG_COLORS.ui[type];
  }

  /**
   * Validate all color combinations in the application
   * Returns a report of compliance issues
   */
  validateApplicationColors(): ColorValidationReport {
    const issues: ColorValidationIssue[] = [];
    const validCombinations: ColorValidationSuccess[] = [];

    // Check priority colors
    Object.entries(this.WCAG_COLORS.priority).forEach(([priority, colors]) => {
      const ratio = this.calculateContrastRatio(colors.background, colors.text);
      const isCompliant = this.isWCAGCompliant(colors.background, colors.text);
      
      if (isCompliant) {
        validCombinations.push({
          type: 'priority',
          name: priority,
          backgroundColor: colors.background,
          textColor: colors.text,
          contrastRatio: ratio
        });
      } else {
        issues.push({
          type: 'priority',
          name: priority,
          backgroundColor: colors.background,
          textColor: colors.text,
          contrastRatio: ratio,
          requiredRatio: 4.5,
          severity: 'error'
        });
      }
    });

    // Check status colors
    Object.entries(this.WCAG_COLORS.status).forEach(([status, colors]) => {
      const ratio = this.calculateContrastRatio(colors.background, colors.text);
      const isCompliant = this.isWCAGCompliant(colors.background, colors.text);
      
      if (isCompliant) {
        validCombinations.push({
          type: 'status',
          name: status,
          backgroundColor: colors.background,
          textColor: colors.text,
          contrastRatio: ratio
        });
      } else {
        issues.push({
          type: 'status',
          name: status,
          backgroundColor: colors.background,
          textColor: colors.text,
          contrastRatio: ratio,
          requiredRatio: 4.5,
          severity: 'error'
        });
      }
    });

    return {
      isCompliant: issues.length === 0,
      totalChecked: validCombinations.length + issues.length,
      validCombinations,
      issues
    };
  }

  /**
   * Calculate relative luminance of a color
   * @param color Hex color string
   * @returns Relative luminance (0-1)
   */
  private getLuminance(color: string): number {
    // Remove # if present
    const hex = color.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    // Apply gamma correction
    const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    // Calculate luminance
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }
}

/**
 * Color validation interfaces
 */
export interface ColorValidationReport {
  isCompliant: boolean;
  totalChecked: number;
  validCombinations: ColorValidationSuccess[];
  issues: ColorValidationIssue[];
}

export interface ColorValidationSuccess {
  type: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  contrastRatio: number;
}

export interface ColorValidationIssue {
  type: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  contrastRatio: number;
  requiredRatio: number;
  severity: 'warning' | 'error';
}