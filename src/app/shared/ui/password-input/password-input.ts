import { Component, forwardRef, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true
    }
  ],
  template: `
    <div class="input-wrapper password-wrapper" [class.has-error]="error">
      <input 
        [id]="inputId" 
        [type]="showPassword() ? 'text' : 'password'" 
        [placeholder]="placeholder"
        [autocomplete]="autocomplete"
        [disabled]="disabled"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()"
        class="form-control"
      />
      <button 
        type="button" 
        class="password-toggle" 
        (click)="togglePassword()"
        [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        tabindex="-1"
      >
        <svg *ngIf="showPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <svg *ngIf="!showPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    </div>
  `,
  styles: [`
    .input-wrapper.password-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    
    .form-control {
      width: 100%;
      height: 3rem;
      padding: 0 1rem;
      padding-right: 3.5rem;
      font-size: 0.9375rem;
      font-family: inherit;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      background-color: #ffffff;
      color: #0f172a;
      transition: all 0.2s ease;
    }

    .form-control::placeholder {
      color: #94a3b8;
    }

    .form-control:focus {
      outline: none;
      border-color: #ea580c;
      box-shadow: 0 0 0 4px rgba(234, 88, 12, 0.1);
    }

    .form-control:hover:not(:focus) {
      border-color: #cbd5e1;
    }
    
    .input-wrapper.has-error .form-control {
      border-color: #dc2626;
    }

    .form-control:disabled {
      background-color: #f8fafc;
      cursor: not-allowed;
      opacity: 0.7;
    }

    .password-toggle {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .password-toggle:hover {
      color: #ea580c;
      background-color: #fff7ed;
    }

    .password-toggle svg {
      width: 20px;
      height: 20px;
    }

    @media (max-width: 768px) {
      .form-control {
        height: 2.875rem;
        font-size: 0.875rem;
      }
    }

    @media (max-width: 640px) {
      .form-control {
        height: 2.75rem;
        font-size: 0.8125rem;
        border-width: 1px;
      }
    }

    @media (max-width: 480px) {
      .form-control {
        height: 2.625rem;
      }
    }

    @media (max-width: 380px) {
      .form-control {
        height: 2.5rem;
        font-size: 0.75rem;
      }
    }
  `]
})
export class PasswordInputComponent implements ControlValueAccessor {
  @Input() inputId = '';
  @Input() placeholder = 'Tu contraseña';
  @Input() autocomplete = 'current-password';
  @Input() error: boolean | string | null | undefined = false;

  showPassword = signal(false);
  value = '';
  disabled = false;

  onChange = (value: string) => {};
  onTouched = () => {};

  togglePassword() {
    this.showPassword.set(!this.showPassword());
  }

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.onChange(val);
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
