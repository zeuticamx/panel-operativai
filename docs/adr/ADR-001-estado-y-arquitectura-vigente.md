# ADR-001 — Estado y arquitectura vigente del Portal de OperativAI

- **Fecha:** 2026-10-14
- **Estado:** Aceptado como foto del estado. Se revisa cuando cambie la arquitectura.
- **Repo:** `zeuticamx/panel-operativai` · rama `main` en `da0b22c` · paquete `operativai-portal` 0.1.0
- **Fuentes:** `README.md` e historial de git.

## Contexto

Portal **multitenant** para dueños de negocio: conversaciones de su agente de IA, canales conectados
(Facebook / Instagram / WhatsApp) y configuración del agente. Es **solo el frontend**: habla con un
backend FastAPI que vive en `../backend`, **fuera de este repositorio**.

Next.js (App Router) + TypeScript. El backend debe correr en `NEXT_PUBLIC_API_URL` (por defecto
`http://localhost:8000`) con `FRONTEND_ORIGINS` incluyendo el origen del portal.

## Decisiones vigentes

Las que el `README.md` declara explícitamente:

- **Sin librería de estado:** `fetch` + hooks (`useApi`).
- **Auth con tokens en `localStorage`** (`operativai_access_token`, `operativai_refresh_token`).
  `apiFetch` agrega `Authorization: Bearer`; ante un 401 llama **una vez** a
  `POST /api/auth/refresh` y reintenta; si el refresh falla, limpia tokens y manda a `/login`.
  Varios 401 simultáneos **comparten un solo refresh**.
- **`lucide-react` v1 ya no trae iconos de marca**: los de WhatsApp, Instagram y Facebook están
  inline en `components/status.tsx`.
- **El filtro de estado solo ofrece `active`**, porque es el único valor que el backend garantiza
  hoy; cualquier otro estado se muestra tal cual en la lista.
- **El alta de WhatsApp (Embedded Signup) no existe en el backend todavía**: el botón aparece
  deshabilitado como «Próximamente».
- **Vendedores es solo vista gerencial.** El portal muestra el embudo, reparte leads y administra al
  equipo; el cambio de etapa de cada lead (`PATCH /clientes/{id}/estado`) lo hace el vendedor desde
  **su propia app**, así que no hay UI para eso aquí. Las acciones que escriben (activar módulo,
  estrategia, alta/baja, reasignar) solo se ofrecen a `owner`/`superadmin`; un `member` ve todo en
  solo lectura.
- **La lista de leads se pide completa (`limite=500`) y se filtra en el cliente**: para gerencia es
  más útil ver todo el embudo que paginar, y los KPIs «sin vendedor» y «abiertos» salen gratis de
  esa misma lista.
- **`output: "standalone"`**: el servidor de producción es `node .next/standalone/server.js`, no
  `next start`.

## Estado al 14 de octubre de 2026

Último movimiento: **2026-10-01**. Es el repo activo más quieto del grupo.

- Ajustes de «Reportar problema» y logs de error en la desconexión de WhatsApp (1 oct).
- Perfil y permisos de `gerencia_users` (30 sep).
- **OAuth de Meta implementado** (28 sep), con un Playwright del flujo de Meta (29 sep) y un arreglo
  del webhook de neuroapi.
- Calendario en la UI para profesionistas, panel de gerencia y planes, ARG de Google.
- **Sin PRs abiertos.** Solo existe `main`.

### Pruebas y CI

- Hay configuración de **Jest** (`jest.config.mjs`, `jest.setup.ts`), con pruebas en
  `tests/components`, y un **Playwright del flujo de Meta**. Scripts: `npm test`, `npm run lint`,
  `npm run typecheck`, `npm run build` (incluye typecheck).
- **No hay CI** (no hay `.github/workflows`; verificado el 2026-10-14) y **no se corrió nada en esta
  sesión**.

## Pendientes y huecos conocidos

1. **El alta de WhatsApp por Embedded Signup falta en el backend**; el botón está deshabilitado.
2. **El filtro de estado está limitado a `active`** por falta de garantías del backend.
3. **Este repo no sigue ramas ni PRs**: los 14 commits van directo a `main`, y los mensajes no usan
   la convención del resto del grupo (salvo los tres primeros, heredados de la landing).
4. No hay `CLAUDE.md`: el `README.md` hace ese papel.

## Riesgos y deuda

- **El backend no está en este repo** (`../backend`): el portal no se puede levantar ni razonar
  completo desde aquí, y no hay nada que fije qué versión del backend corresponde a qué versión del
  portal.
- **El remote está en otra organización** (`zeuticamx`), distinta de los demás repos del dueño
  (`JcLimonero`). *Confirmar que el acceso y la propiedad son los deseados.*
- Tokens en `localStorage` (no en cookie `HttpOnly`) en un portal multitenant.
- Hay dos repos de OperativAI con nombre parecido: este y `landig_opertaivai` (la landing).

## Lo que sigue

1. Localizar y documentar dónde vive el backend FastAPI y cómo se versiona junto al portal.
2. Decidir si el portal adopta ramas + PR como el resto de los proyectos.
3. Cerrar el Embedded Signup de WhatsApp cuando el backend lo soporte.
