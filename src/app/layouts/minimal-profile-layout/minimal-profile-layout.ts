import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-minimal-profile-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="minimal-profile-layout">
      <div class="profile-container">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .minimal-profile-layout {
      min-height: 100vh;
      background: linear-gradient(135deg, #fef3f2 0%, #fff7ed 100%);
      padding: 2rem 1rem;
    }
    
    .profile-container {
      max-width: 900px;
      margin: 0 auto;
      position: relative;
    }
    
    @media (max-width: 768px) {
      .minimal-profile-layout {
        padding: 1rem 0.75rem;
      }
    }
  `]
})
export class MinimalProfileLayout {}
