import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

export interface UploadResponse {
  file_name: string;
  file_url: string;
  file_type: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
}

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Subir imagen de vehículo
   */
  uploadVehicleImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<UploadResponse>>(
        `${this.apiUrl}/vehiculos/upload/image`,
        formData
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Subir imagen de incidente
   */
  uploadIncidentImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<UploadResponse>>(
        `${this.apiUrl}/incidentes/upload/image`,
        formData
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Subir audio de incidente
   */
  uploadIncidentAudio(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<UploadResponse>>(
        `${this.apiUrl}/incidentes/upload/audio`,
        formData
      )
      .pipe(map((response) => response.data));
  }
}
