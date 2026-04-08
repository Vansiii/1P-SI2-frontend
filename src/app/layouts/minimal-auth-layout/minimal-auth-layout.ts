import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-minimal-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="minimal-layout">
      <div class="card-container">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .minimal-layout {
      min-height: 100vh;
      background: linear-gradient(135deg, #fef3f2 0%, #fff7ed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
    }
    
    .card-container {
      background: white;
      width: 100%;
      max-width: 380px;
      padding: 1.25rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(249, 115, 22, 0.1);
    }
    
    @media (max-height: 700px) {
      .card-container {
        padding: 1rem;
      }
    }
  `]
})
export class MinimalAuthLayout {}
