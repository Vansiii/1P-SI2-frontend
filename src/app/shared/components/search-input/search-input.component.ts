import { Component, ChangeDetectionStrategy, input, output, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DebounceService } from '../../services/debounce.service';

/**
 * SearchInputComponent
 * 
 * Reusable search input component with debouncing functionality.
 * Prevents excessive search operations by debouncing user input.
 * 
 * Features:
 * - Debounced search input (300ms delay)
 * - Customizable placeholder text
 * - Clear button functionality
 * - Accessible input with proper ARIA labels
 * 
 * Requirements: 11.5
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-input-container">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        
        <input
          type="text"
          class="search-input"
          [placeholder]="placeholder()"
          [value]="searchValue()"
          (input)="onInput($event)"
          [attr.aria-label]="ariaLabel() || 'Buscar'"
          autocomplete="off"
        />
        
        @if (searchValue()) {
          <button
            type="button"
            class="clear-button"
            (click)="clearSearch()"
            aria-label="Limpiar búsqueda"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .search-input-container {
      width: 100%;
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      width: 20px;
      height: 20px;
      color: #6b7280;
      z-index: 1;
    }

    .search-input {
      width: 100%;
      padding: 12px 16px 12px 44px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
      background-color: #ffffff;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: #f97316;
      box-shadow: 0 0 0 3px rgb(249 115 22 / 0.1);
    }

    .search-input::placeholder {
      color: #9ca3af;
    }

    .clear-button {
      position: absolute;
      right: 12px;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: none;
      color: #6b7280;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: color 0.2s ease, background-color 0.2s ease;
    }

    .clear-button:hover {
      color: #374151;
      background-color: #f3f4f6;
    }

    .clear-button:focus {
      outline: none;
      color: #374151;
      background-color: #f3f4f6;
    }

    .clear-button svg {
      width: 16px;
      height: 16px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchInputComponent implements OnInit, OnDestroy {
  // Services
  private debounceService = inject(DebounceService);

  // Input signals
  placeholder = input<string>('Buscar...');
  ariaLabel = input<string>('');
  initialValue = input<string>('');

  // Output
  searchChange = output<string>();

  // Local state
  searchValue = signal<string>('');

  // Debounce configuration
  private readonly DEBOUNCE_KEY = 'search-input';
  private readonly DEBOUNCE_DELAY = 300; // ms

  ngOnInit(): void {
    // Set initial value if provided
    if (this.initialValue()) {
      this.searchValue.set(this.initialValue());
    }

    // Set up debounced search
    const { input$, output$ } = this.debounceService.createDebouncedObservable<string>(
      this.DEBOUNCE_KEY,
      this.DEBOUNCE_DELAY
    );

    // Subscribe to debounced output and emit to parent
    output$.pipe(
      takeUntilDestroyed()
    ).subscribe(searchTerm => {
      this.searchChange.emit(searchTerm);
    });
  }

  ngOnDestroy(): void {
    // Clean up debounce stream
    this.debounceService.cleanup(this.DEBOUNCE_KEY);
  }

  /**
   * Handle input changes with debouncing
   */
  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    
    // Update local state immediately for UI responsiveness
    this.searchValue.set(value);
    
    // Emit to debounced stream
    this.debounceService.emit(this.DEBOUNCE_KEY, value);
  }

  /**
   * Clear search input
   */
  clearSearch(): void {
    this.searchValue.set('');
    this.debounceService.emit(this.DEBOUNCE_KEY, '');
  }
}