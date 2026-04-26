# Script para generar certificado SSL autofirmado para desarrollo local
# Ejecutar como administrador en PowerShell

Write-Host "🔐 Generando certificado SSL para desarrollo local..." -ForegroundColor Cyan

# Crear directorio para certificados si no existe
$certDir = "ssl"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir | Out-Null
    Write-Host "✅ Directorio 'ssl' creado" -ForegroundColor Green
}

# Generar certificado autofirmado
$cert = New-SelfSignedCertificate `
    -Subject "localhost" `
    -DnsName "localhost", "127.0.0.1" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -NotBefore (Get-Date) `
    -NotAfter (Get-Date).AddYears(2) `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -FriendlyName "Localhost Development Certificate" `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature, KeyEncipherment, DataEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")

Write-Host "✅ Certificado generado: $($cert.Thumbprint)" -ForegroundColor Green

# Exportar certificado a archivo PEM
$certPath = Join-Path $certDir "localhost.crt"
$keyPath = Join-Path $certDir "localhost.key"

# Exportar certificado
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[System.IO.File]::WriteAllBytes($certPath, $certBytes)
Write-Host "✅ Certificado exportado: $certPath" -ForegroundColor Green

# Exportar clave privada (requiere contraseña temporal)
$password = ConvertTo-SecureString -String "temp" -Force -AsPlainText
$pfxPath = Join-Path $certDir "localhost.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

# Convertir PFX a PEM usando OpenSSL (si está disponible)
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    Write-Host "🔄 Convirtiendo certificado a formato PEM..." -ForegroundColor Cyan
    
    # Extraer clave privada
    openssl pkcs12 -in $pfxPath -nocerts -out $keyPath -nodes -password pass:temp 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Clave privada exportada: $keyPath" -ForegroundColor Green
        
        # Limpiar archivo PFX temporal
        Remove-Item $pfxPath -Force
        
        Write-Host ""
        Write-Host "✅ Certificado SSL generado exitosamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📁 Archivos generados:" -ForegroundColor Cyan
        Write-Host "   - $certPath" -ForegroundColor White
        Write-Host "   - $keyPath" -ForegroundColor White
        Write-Host ""
        Write-Host "🚀 Para usar HTTPS en desarrollo:" -ForegroundColor Cyan
        Write-Host "   npm run start:ssl" -ForegroundColor White
        Write-Host ""
        Write-Host "⚠️  Nota: Chrome mostrará advertencia de certificado autofirmado" -ForegroundColor Yellow
        Write-Host "   Haz clic en 'Avanzado' → 'Continuar a localhost (no seguro)'" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error al convertir certificado. OpenSSL no funcionó correctamente." -ForegroundColor Red
        Write-Host "💡 Solución alternativa: Usa las flags de Chrome (ver documentación)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  OpenSSL no está instalado" -ForegroundColor Yellow
    Write-Host "💡 Instala OpenSSL o usa las flags de Chrome para desarrollo" -ForegroundColor Yellow
    Write-Host "   Descarga: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🔒 Certificado instalado en el almacén de Windows" -ForegroundColor Green
Write-Host "   Ubicación: Cert:\CurrentUser\My\$($cert.Thumbprint)" -ForegroundColor White
