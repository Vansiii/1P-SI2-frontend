import { bootstrapApplication } from '@angular/platform-browser';
import { isDevMode } from '@angular/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';

if (isDevMode() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
      console.log('[dev] Unregistered stale SW:', reg.scope);
    }
  });
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
