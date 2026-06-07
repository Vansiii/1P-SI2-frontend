import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface VoiceRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

@Injectable({ providedIn: 'root' })
export class VoiceRecognitionService {
  private recognition: any = null;
  private listening$ = new BehaviorSubject<boolean>(false);
  private result$ = new BehaviorSubject<VoiceRecognitionResult | null>(null);
  private error$ = new BehaviorSubject<string | null>(null);
  private lastTranscript = '';

  isListening = this.listening$.asObservable();
  onResult = this.result$.asObservable();
  onError = this.error$.asObservable();

  constructor(private ngZone: NgZone) {}

  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(lang = 'es-ES'): void {
    if (!this.isSupported()) {
      this.error$.next('El reconocimiento de voz no esta soportado en este navegador.');
      return;
    }

    if (this.recognition) {
      this.recognition.abort();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = lang;
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.lastTranscript = '';

    this.recognition.onresult = (event: any) => {
      this.ngZone.run(() => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript.trim();
        this.lastTranscript = transcript;
        this.result$.next({
          transcript,
          isFinal: lastResult.isFinal,
          confidence: lastResult[0].confidence,
        });
      });
    };

    this.recognition.onerror = (event: any) => {
      this.ngZone.run(() => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        this.error$.next('Error de voz: ' + event.error);
        this.listening$.next(false);
      });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        this.listening$.next(false);
        // If recognition ended and we have text but no final result was emitted,
        // emit what we have as final
        if (this.lastTranscript && this.recognition) {
          this.result$.next({
            transcript: this.lastTranscript,
            isFinal: true,
            confidence: 0.8,
          });
        }
      });
    };

    this.recognition.start();
    this.listening$.next(true);
    this.error$.next(null);
  }

  stop(): void {
    if (this.recognition) {
      // Important: call stop() not abort() so Chrome fires onresult with final text
      this.recognition.stop();
    }
  }
}
