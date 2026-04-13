import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  template: `
    <div class="not-found-container">
      <div class="not-found-content">
        <div class="error-badge">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="error-code">404</div>
        <h1>Página no encontrada</h1>
        <p>La página que buscas no existe o ha sido movida. Verifica la URL o regresa al inicio.</p>
        <div class="actions">
          <button class="btn-primary" (click)="goHome()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            Ir al inicio
          </button>
          <button class="btn-secondary" (click)="goBack()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Volver atrás
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
    }

    .not-found-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }

    .not-found-content {
      max-width: 480px;
      text-align: center;
      animation: fadeIn 0.5s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .error-badge {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: #fef2f2;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ef4444;
      animation: bounce 1s ease infinite;
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }

    .error-code {
      font-size: 6rem;
      font-weight: 800;
      color: #111827;
      line-height: 1;
      margin-bottom: 1rem;
      letter-spacing: -0.05em;
      opacity: 0.1;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 0.75rem 0;
      letter-spacing: -0.02em;
    }

    p {
      font-size: 1rem;
      color: #6b7280;
      margin: 0 0 2rem 0;
      line-height: 1.6;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 10px;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      outline: none;
    }

    .btn-primary {
      background: #111827;
      color: white;
    }

    .btn-primary:hover {
      background: #1f2937;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(17, 24, 39, 0.2);
    }

    .btn-primary:active {
      transform: translateY(0);
    }

    .btn-secondary {
      background: white;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }

    .btn-secondary:hover {
      background: #f9fafb;
      border-color: #d1d5db;
      color: #111827;
      transform: translateY(-2px);
    }

    .btn-secondary:active {
      transform: translateY(0);
    }

    @media (max-width: 640px) {
      .not-found-container {
        padding: 1.5rem;
      }

      .error-badge {
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
      }

      .error-badge svg {
        width: 28px;
        height: 28px;
      }

      .error-code {
        font-size: 4.5rem;
      }

      h1 {
        font-size: 1.5rem;
      }

      p {
        font-size: 0.9375rem;
      }

      button {
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
      }

      button svg {
        width: 16px;
        height: 16px;
      }
    }

    @media (max-width: 380px) {
      .error-code {
        font-size: 3.5rem;
      }

      h1 {
        font-size: 1.25rem;
      }

      p {
        font-size: 0.875rem;
      }

      .actions {
        flex-direction: column;
        width: 100%;
      }

      button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class NotFoundComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  goBack(): void {
    window.history.back();
  }
}
