import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="otp-container" (paste)="onPaste($event)">
      @for (digit of digits; track $index) {
        <input 
          #otpInput
          type="text" 
          inputmode="numeric"
          maxlength="1"
          autocomplete="one-time-code"
          [disabled]="disabled"
          [class.has-error]="error"
          (input)="onInput($event, $index)"
          (keydown)="onKeyDown($event, $index)"
        />
      }
    </div>
  `,
  styles: [`
    .otp-container {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      margin: 1.5rem 0;
    }
    input {
      width: 50px;
      height: 60px;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-main, #0f172a);
      border: 2px solid var(--border-light, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      background: var(--bg-surface, #ffffff);
      transition: all 0.2s ease;
    }
    input:focus {
      outline: none;
      border-color: var(--primary, #ea580c);
      box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15);
    }
    input.has-error {
      border-color: var(--text-error, #ef4444);
      color: var(--text-error, #ef4444);
    }
    input:disabled {
      background: var(--bg-app, #f8fafc);
      opacity: 0.7;
      cursor: not-allowed;
    }
  `]
})
export class OtpInputComponent {
  @Input() length = 6;
  @Input() disabled = false;
  @Input() error = false;
  @Output() codeComplete = new EventEmitter<string>();
  @Output() codeChange = new EventEmitter<string>();

  @ViewChildren('otpInput') inputs!: QueryList<ElementRef<HTMLInputElement>>;
  
  digits: number[];

  constructor() {
    this.digits = Array(this.length).fill(0);
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!/^[0-9]$/.test(value)) {
      input.value = '';
      this.emitChange();
      return;
    }

    if (value && index < this.length - 1) {
      this.inputs.toArray()[index + 1].nativeElement.focus();
    }

    this.emitChange();
    this.checkCompletion();
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      const input = event.target as HTMLInputElement;
      if (!input.value && index > 0) {
        this.inputs.toArray()[index - 1].nativeElement.focus();
      }
      setTimeout(() => this.emitChange(), 0);
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text').trim();
    
    if (!pastedData || !/^\\d+$/.test(pastedData)) return;

    const characters = pastedData.split('').slice(0, this.length);
    const inputElements = this.inputs.toArray();

    characters.forEach((char, i) => {
      inputElements[i].nativeElement.value = char;
    });

    const focusIndex = Math.min(characters.length, this.length - 1);
    inputElements[focusIndex].nativeElement.focus();

    this.emitChange();
    this.checkCompletion();
  }

  private emitChange() {
    const code = this.inputs.toArray().map(i => i.nativeElement.value).join('');
    this.codeChange.emit(code);
  }

  private checkCompletion() {
    const code = this.inputs.toArray().map(i => i.nativeElement.value).join('');
    if (code.length === this.length) {
      this.codeComplete.emit(code);
    }
  }
}
