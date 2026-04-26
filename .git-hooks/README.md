# Git Hooks

Este directorio contiene git hooks personalizados para el proyecto.

## Instalación

Para instalar los hooks, ejecuta el siguiente comando desde la raíz del proyecto frontend:

```bash
# En Windows (PowerShell)
Copy-Item .git-hooks/pre-commit .git/hooks/pre-commit -Force

# En Linux/Mac
cp .git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

O configura git para usar este directorio de hooks:

```bash
git config core.hooksPath .git-hooks
```

## Hooks Disponibles

### pre-commit

Ejecuta verificaciones antes de cada commit:

1. **ESLint**: Verifica que no haya errores de linting
2. **Subscription Management**: Verifica que todas las suscripciones usen `takeUntilDestroyed()`

Si alguna verificación falla, el commit será rechazado.

### Bypass (Solo en Emergencias)

Si necesitas hacer un commit sin ejecutar los hooks (NO RECOMENDADO):

```bash
git commit --no-verify -m "mensaje"
```

## Troubleshooting

### El hook no se ejecuta

1. Verifica que el archivo tenga permisos de ejecución:
   ```bash
   chmod +x .git/hooks/pre-commit
   ```

2. Verifica que git esté configurado para usar los hooks:
   ```bash
   git config core.hooksPath
   ```

### El hook falla con errores de ESLint

1. Ejecuta el linter manualmente para ver los errores:
   ```bash
   npm run lint
   ```

2. Intenta arreglar automáticamente los errores:
   ```bash
   npm run lint:fix
   ```

3. Arregla manualmente los errores restantes antes de hacer commit
