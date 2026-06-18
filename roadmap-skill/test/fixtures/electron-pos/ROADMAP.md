# Roadmap del Producto

<!-- rs:managed:start -->
## Product North Star
Convertir el POS actual en una app Electron offline-first con SQLite embebido, sin perder continuidad operativa en caja ni el conocimiento del dominio ya validado con clientes.

## Contexto del dominio
La operacion debe seguir vendiendo aunque no haya internet, con sincronizacion diferida cuando vuelva la conectividad.

### P0 - Migracion Firebase -> Electron + SQLite
- [ ] Migrar autenticacion local para operar 100% offline <!-- rs:task=pos-migrar-autenticacion-local-offline -->
  - Evidence: electron/main.ts
- [ ] Reemplazar persistencia remota por SQLite embebido <!-- rs:task=pos-reemplazar-persistencia-remota-sqlite -->
  - Evidence: src/renderer.tsx
  - ⚠️ attempted but validation failed: falta cobertura sobre recuperacion offline

#### Paso operativo
El flujo de ventas no debe depender de servicios web para abrir caja o cerrar turnos.

### P1 - Corte y caja
- [ ] Validar cierre de caja diario en modo escritorio <!-- rs:task=pos-validar-cierre-caja-diario -->
  - Evidence: ROADMAP.md
<!-- rs:managed:end -->
