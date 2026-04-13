import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vehicle-form.html',
  styleUrls: ['./vehicle-form.css']
})
export class VehicleFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);

  vehicleForm: FormGroup;
  isSubmitting = signal(false);
  isUploadingImage = signal(false);
  uploadedImageUrl = signal<string | null>(null);
  selectedImageFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor() {
    this.vehicleForm = this.fb.group({
      matricula: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      marca: ['', [Validators.maxLength(60)]],
      modelo: ['', [Validators.required, Validators.maxLength(100)]],
      anio: ['', [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
      color: ['', [Validators.maxLength(50)]]
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        this.errorMessage.set('Por favor selecciona un archivo de imagen válido');
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage.set('La imagen no debe superar los 5MB');
        return;
      }

      this.selectedImageFile.set(file);
      this.errorMessage.set(null);

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Subir automáticamente
      this.uploadImage();
    }
  }

  uploadImage(): void {
    const file = this.selectedImageFile();
    if (!file) return;

    this.isUploadingImage.set(true);
    this.errorMessage.set(null);

    this.uploadService.uploadVehicleImage(file).subscribe({
      next: (response) => {
        this.uploadedImageUrl.set(response.file_url);
        this.isUploadingImage.set(false);
        this.successMessage.set('Imagen subida exitosamente');
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error) => {
        this.isUploadingImage.set(false);
        this.errorMessage.set(error.error?.error?.message || 'Error al subir la imagen');
      }
    });
  }

  removeImage(): void {
    this.selectedImageFile.set(null);
    this.imagePreview.set(null);
    this.uploadedImageUrl.set(null);
  }

  onSubmit(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    if (this.isUploadingImage()) {
      this.errorMessage.set('Espera a que termine de subir la imagen');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.vehicleForm.value;
    const request = {
      matricula: formValue.matricula.trim().toUpperCase(),
      marca: formValue.marca?.trim() || undefined,
      modelo: formValue.modelo.trim(),
      anio: parseInt(formValue.anio, 10),
      color: formValue.color?.trim() || undefined,
      imagen: this.uploadedImageUrl() || undefined
    };

    this.vehiclesService.createVehicle(request).subscribe({
      next: () => {
        this.successMessage.set('Vehículo registrado exitosamente');
        setTimeout(() => {
          this.router.navigate(['/vehicles']);
        }, 1500);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error.error?.error?.message || 'Error al registrar el vehículo');
      }
    });
  }

  getFieldError(fieldName: string): string | null {
    const field = this.vehicleForm.get(fieldName);
    if (field?.invalid && (field.dirty || field.touched)) {
      if (field.errors?.['required']) return 'Este campo es requerido';
      if (field.errors?.['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors?.['maxlength']) return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
      if (field.errors?.['min']) return `Valor mínimo: ${field.errors['min'].min}`;
      if (field.errors?.['max']) return `Valor máximo: ${field.errors['max'].max}`;
    }
    return null;
  }
}
