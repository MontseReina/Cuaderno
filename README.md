# Cuaderno de cuidados

App de seguimiento diario de un paciente oncológico pediátrico para sus cuidadores. Web App progresiva (se instala en el móvil, funciona con conexión débil, se abre también en el ordenador). Multiusuario, sin roles, con registro oculto de actividad.

> Esta app registra y organiza información; **no da indicaciones médicas**. Los umbrales del semáforo diario son una propuesta pendiente de validar con el equipo de oncología.

## Estado (v0.3 — fase 1 completa + modelo de un solo fichero)

Implementado: Inicio con semáforo diario y tira de 21 días · Registro diario (constantes, síntomas en ciclo / fuera de ciclo + signos de diagnósticos activos, cuidados preventivos por día del ciclo, comidas por fracción y carga de hidratos, líquidos, sueño y luz, actividad y pasos) · Diagnósticos y evolución · Tratamiento y ciclos (rescate, antiemético, corticoide IV, dosis acumulada, vigilancia por fármaco, horas de ayuno) · Medicación y suplementos en tres bloques con semáforo por ventana y tomas del día · Analíticas (fuera de rango, tendencias, pruebas de órgano) · Microbiota (tests y comparativa) · Ejercicio (sesiones y capacidad funcional) · Emocional (niño semanal, cuidadora diaria + Zarit reducido con aviso automático) · Nutrición (vista de análisis: ingesta, hidratos, líquidos, ventana y ayuno, peso, glucosa con días de corticoide) · Biohacking (tendencias de sueño y sincronizadores, exposiciones semanales, catálogo de prácticas con semáforo de seguridad) · Biblioteca (accesos al Drive) · mifamurtida y cirugía en ciclos · aviso de cura del catéter · racha de días registrados · Calendario con resultados esperados · Pendientes asignables con indicador en cabecera · Preguntas al equipo por profesional · Informe de consulta imprimible.

Añadido en v0.3 (modelo "un solo fichero"): PIN de acceso · Datos y copias (exportar copia completa JSON, importar y fusionar por id, CSV por tabla, informe para IA en Markdown por rango de fechas, aviso de copia > 2 días, versión y esquema visibles, datos de ejemplo, borrar todo) · metaetiquetas iOS e icono embebido · `sw.js` para abrir sin conexión · guía de GitHub Pages (`GUIA-PUBLICAR-GITHUB-PAGES.md`).

Pendiente (fase 2-3): notificaciones push, adjuntos (fotos/PDF/voz) en Supabase Storage, extracción automática de analíticas desde foto, biblioteca del Drive con "preguntar".

## Dos modos de funcionamiento

- **Un solo fichero** (por defecto, sin configurar nada): los datos se guardan en el propio aparato; los aparatos se ponen al día exportando e importando copias. Se publica en GitHub Pages: `npm run build:demo` → `dist-demo/index.html` + `dist-demo/sw.js`. Ver `GUIA-PUBLICAR-GITHUB-PAGES.md`.
- **Supabase** (opcional, más adelante): varios usuarios sincronizados en tiempo real, copia en la nube, registro de actividad. Se activa rellenando `.env` y desplegando con `npm run build`.

## Puesta en marcha real (≈ 30 minutos)

### 1. Supabase (base de datos y usuarios)

1. Crear cuenta en https://supabase.com → **New project**. Región: **Frankfurt (eu-central-1)**. Guardar la contraseña de la base de datos.
2. **SQL Editor → New query**: pegar el contenido completo de `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: dejar activado "Email" y "Confirm email" (los usuarios entran con un enlace por correo, sin contraseña).
4. **Authentication → URL Configuration**: en *Site URL* poner la URL donde vivirá la app (la de Vercel, paso 3); en *Redirect URLs* añadir la misma.
5. **Authentication → Users → Invite user**: invitar a cada cuidador por correo.
6. **Project Settings → API**: copiar `Project URL` y `anon public key`.

Después de que el **primer** usuario entre y cree el paciente en la app, dar acceso a los demás (SQL Editor):

```sql
insert into patient_members(patient_id, user_id)
select p.id, u.id from patients p, auth.users u where u.email = 'correo@ejemplo.com';
```

### 2. Código (GitHub)

```bash
git init && git add . && git commit -m "Cuaderno de cuidados v0.1"
# crear el repositorio (privado) en GitHub y:
git remote add origin git@github.com:USUARIO/cuaderno-cuidados.git
git push -u origin main
```

### 3. Alojamiento (Vercel, gratuito)

1. https://vercel.com → **Add New Project** → importar el repositorio.
2. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. **Environment Variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (del paso 1.6).
4. Deploy. La URL resultante es la de la app; volver al paso 1.4 para ponerla en Supabase.

En el móvil: abrir la URL → menú del navegador → **"Añadir a pantalla de inicio"**.

### Alternativa: servidor propio

`npm run build` genera `dist/` (archivos estáticos). Servirlos con cualquier servidor web (nginx, Apache, Caddy) con HTTPS. Supabase puede autoalojarse también (docker), pero no es necesario.

## Desarrollo local

```bash
npm install
cp .env.example .env      # opcional; vacío = modo demo
npm run dev               # http://localhost:5173
npm run build             # producción (PWA)
npm run build:demo        # un solo HTML para demostración
```

## Estructura

```
src/
  store/        capa de datos: types.ts (modelo), local.ts (demo), supabase.ts (real)
  domain/       lógica: día del ciclo, semáforo, catálogos, nutrición, semilla de productos
  pages/        una pantalla por apartado
  components/   controles reutilizables (segmentos, caras, stepper…)
supabase/schema.sql   esquema completo con RLS, borrado lógico y audit_log
```

## Registro oculto de actividad

Cada creación, modificación y borrado queda en `audit_log` con usuario, fecha y valores antes/después. No se muestra en la app. Para consultarlo: Supabase → SQL Editor:

```sql
select at, user_email, table_name, action, row_id from audit_log order by at desc limit 200;
```

Los borrados son lógicos (`deleted_at`): un registro borrado por error se recupera poniendo `deleted_at = null`.

## Privacidad

Datos de salud de un menor: proyecto en la UE, acceso solo por invitación, cifrado en tránsito y en reposo, copias diarias de Supabase. La app no envía datos a ningún otro servicio.
