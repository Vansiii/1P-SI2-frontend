import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RegisterTokenRequest {
  token: string;
  platform: string;
  device_id?: string;
}

export interface UnregisterTokenRequest {
  token: string;
}

export interface TokenResponse {
  message: string;
  user_id: number;
  platform?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PushTokenService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/push`;

  /**
   * Registrar token FCM en el backend
   */
  async registerToken(request: RegisterTokenRequest): Promise<TokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(`${this.baseUrl}/tokens/register`, request)
      );
      console.log('✅ Token registered successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error registering token:', error);
      throw error;
    }
  }

  /**
   * Desregistrar token FCM específico
   */
  async unregisterToken(request: UnregisterTokenRequest): Promise<TokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.delete<TokenResponse>(`${this.baseUrl}/tokens/unregister`, {
          body: request
        })
      );
      console.log('✅ Token unregistered successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error unregistering token:', error);
      throw error;
    }
  }

  /**
   * Desregistrar todos los tokens del usuario (útil para logout)
   */
  async unregisterAllTokens(): Promise<TokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.delete<TokenResponse>(`${this.baseUrl}/tokens/unregister-all`)
      );
      console.log('✅ All tokens unregistered successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error unregistering all tokens:', error);
      throw error;
    }
  }

  /**
   * Obtener tokens del usuario
   */
  getUserTokens(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tokens`);
  }

  /**
   * Obtener estado del servicio de notificaciones
   */
  getStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/status`);
  }

  /**
   * Enviar notificación de prueba
   */
  sendTestNotification(message: string = 'Test notification'): Observable<any> {
    return this.http.post(`${this.baseUrl}/test`, { message });
  }
}