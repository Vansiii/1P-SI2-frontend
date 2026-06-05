import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly isOnline = signal<boolean>(navigator.onLine);
  readonly onlineChange$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this._setOnline(true));
    window.addEventListener('offline', () => this._setOnline(false));
  }

  private _setOnline(value: boolean): void {
    this.isOnline.set(value);
    this.onlineChange$.next(value);
  }

  get online(): boolean {
    return this.isOnline();
  }
}
