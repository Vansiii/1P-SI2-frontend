import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Specialty {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpecialtyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/specialties`;

  getAllSpecialties(): Observable<Specialty[]> {
    return this.http
      .get<ApiResponse<Specialty[]>>(`${this.apiUrl}`)
      .pipe(map(response => response.data));
  }

  getSpecialtyById(specialtyId: number): Observable<Specialty> {
    return this.http
      .get<ApiResponse<Specialty>>(`${this.apiUrl}/${specialtyId}`)
      .pipe(map(response => response.data));
  }
}
