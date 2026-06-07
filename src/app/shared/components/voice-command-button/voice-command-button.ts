import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject, DestroyRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VoiceRecognitionService, VoiceRecognitionResult } from '../../../core/services/voice-recognition.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface VoiceCommandOutput {
  texto_transcrito: string;
  comando: {
    action: string;
    type: string | null;
    filters: Record<string, string>;
    confidence: number;
    response_text: string;
  };
}

@Component({
  selector: 'app-voice-command-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <button
      class="voice-fab"
      [class.listening]="isListening()"
      [class.processing]="isProcessing()"
      [class.error]="hasError()"
      [title]="tooltipText()"
      (click)="toggle()"
      [disabled]="isProcessing() || !voiceSvc.isSupported()"
      aria-label="Comando de voz">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" x2="12" y1="19" y2="22"/>
      </svg>
    </button>
    @if (currentTranscript()) {
      <div class="voice-bubble" [class.final]="isFinal()">
        {{ currentTranscript() }}
      </div>
    }
    @if (responseText()) {
      <div class="voice-response">{{ responseText() }}</div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-flex; align-items: center; gap: 0.75rem; }
    .voice-fab {
      width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--border-light);
      background: var(--surface); color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: all 0.2s;
      flex-shrink: 0;
    }
    .voice-fab svg { width: 20px; height: 20px; }
    .voice-fab:hover { border-color: var(--primary); color: var(--primary); }
    .voice-fab:disabled { opacity: 0.4; cursor: not-allowed; }
    .voice-fab.listening {
      border-color: var(--primary); background: var(--primary); color: white;
      animation: voicePulse 1.5s infinite;
    }
    .voice-fab.processing { border-color: #eab308; background: #fefce8; color: #eab308; }
    .voice-fab.error { border-color: var(--error); background: #fee2e2; color: var(--error); }
    @keyframes voicePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
      50% { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
    }
    .voice-bubble {
      background: var(--surface); border: 1px solid var(--border-light); border-radius: 12px;
      padding: 0.5rem 1rem; font-size: 0.85rem; max-width: 280px; color: var(--text-muted);
      font-style: italic;
    }
    .voice-bubble.final { color: var(--text-main); font-style: normal; }
    .voice-response {
      background: #dcfce7; border-radius: 12px; padding: 0.5rem 1rem;
      font-size: 0.8rem; max-width: 280px; color: #166534; font-weight: 500;
    }
  `,
})
export class VoiceCommandButtonComponent {
  voiceSvc = inject(VoiceRecognitionService);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  @Input() label = 'Voz';
  @Output() commandResult = new EventEmitter<VoiceCommandOutput>();

  isListening = signal(false);
  isProcessing = signal(false);
  hasError = signal(false);
  currentTranscript = signal('');
  isFinal = signal(false);
  responseText = signal('');

  constructor() {
    this.voiceSvc.onResult.pipe(takeUntilDestroyed()).subscribe((r: VoiceRecognitionResult | null) => {
      if (!r) return;
      this.currentTranscript.set(r.transcript);
      this.isFinal.set(r.isFinal);
      if (r.isFinal && r.transcript) {
        this.isListening.set(false);
        this.voiceSvc.stop();
        this.processCommand(r.transcript);
      }
    });
    this.voiceSvc.isListening.pipe(takeUntilDestroyed()).subscribe(v => this.isListening.set(v));
    this.voiceSvc.onError.pipe(takeUntilDestroyed()).subscribe(err => {
      if (err) { this.hasError.set(true); setTimeout(() => this.hasError.set(false), 3000); }
    });
  }

  toggle(): void {
    if (this.isListening()) { this.voiceSvc.stop(); return; }
    this.currentTranscript.set('');
    this.isFinal.set(false);
    this.responseText.set('');
    this.hasError.set(false);
    this.voiceSvc.start('es-ES');
  }

  private processCommand(text: string): void {
    this.isProcessing.set(true);
    this.http.post<{ data: VoiceCommandOutput }>(`${environment.apiBaseUrl}/voice/command`, { texto: text })
      .subscribe({
        next: (res) => {
          this.isProcessing.set(false);
          if (res.data?.comando?.response_text) {
            this.responseText.set(res.data.comando.response_text);
          }
          this.commandResult.emit(res.data);
        },
        error: () => {
          this.isProcessing.set(false);
          this.hasError.set(true);
          setTimeout(() => this.hasError.set(false), 3000);
        },
      });
  }

  tooltipText(): string {
    if (!this.voiceSvc.isSupported()) return 'Voz no soportada en este navegador';
    if (this.isListening()) return 'Escuchando... click para cancelar';
    return 'Comando de voz';
  }
}
