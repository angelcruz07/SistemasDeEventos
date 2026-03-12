# Análisis y refactorizaciones críticas — Sistemas de Eventos

Documento de diagnóstico y evidencia de mejoras realizadas en el proyecto, desde el rol de ingeniero en sistemas.

---

## A) Diagnóstico


| **Problema detectado**                         | **¿Por qué es problema?**                                                                                                                                                             | **Tipo de mejora**                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **API de upload sin validación de sesión**     | **Cualquiera puede enviar** `POST` **a** `/api/upload/cloudinary` **y consumir la cuota de Cloudinary; riesgo de abuso y coste.**                                                     | **Correctivo (seguridad)**                          |
| **Eventos cancelados visibles y confirmables** | `getEventBySlug` **y** `getEventBySlugWithAttendanceCount` **no filtraban** `isCancelled`**. Los eventos cancelados seguían en** `/event/[slug]` **y se podía confirmar asistencia.** | **Correctivo (lógica de negocio)**                  |
| **Typo en interfaz: `createBy`**               | **La interfaz local usa** `createBy` **mientras Prisma y el resto del código usan** `createdBy`**. Desalineación de contrato y mantenimiento.**                                       | **Refactor**                                        |
| **Middleware de protección no enlazado**       | `proxy.ts` **define protección de rutas pero no existe** `middleware.ts` **que lo use; Next.js solo ejecuta** `middleware.ts` **en la raíz.**                                         | **Mejora sugerida (no aplicada en este documento)** |
| **Inconsistencia longitud de contraseña**      | **Better Auth:** `minPasswordLength: 6`**; formulario de registro valida “al menos 8”. Mensajes y reglas distintos.**                                                                 | **Refactor (aplicada)**                             |
| **Dos formas de obtener sesión**               | **Uso de** `auth.api.getSession({ headers })` **en varios sitios y también** `getSession()` **de** `lib/auth-server.ts`**. Duplicación de patrón.**                                   | **Mejora sugerida (refactor)**                      |


En este documento se aplicaron **cuatro mejoras reales**: upload con sesión, eventos cancelados, typo `createdBy` e inconsistencia de contraseña.

---

## B) Evidencia del cambio

### Mejora 1: Proteger la API de upload con validación de sesión

**Problema:** La ruta `POST /api/upload/cloudinary` no comprobaba si el usuario estaba autenticado.

**ANTES** (`app/api/upload/cloudinary/route.ts`):

```ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// ... getCloudinaryConfig() ...

export async function POST(request: Request) {
  const config = getCloudinaryConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary no está configurado. ..." },
      { status: 503 }
    );
  }
  // ... resto sin comprobar sesión
```

**DESPUÉS** (`app/api/upload/cloudinary/route.ts`):

```ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";

// ... getCloudinaryConfig() ...

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json(
      { error: "Debes iniciar sesión para subir imágenes." },
      { status: 401 }
    );
  }

  const config = getCloudinaryConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Cloudinary no está configurado. ..." },
      { status: 503 }
    );
  }
  // ... resto igual
```

**Resumen:** Se exige sesión válida antes de usar Cloudinary; si no hay sesión se responde `401` con mensaje claro.

---

### Mejora 2: Excluir eventos cancelados en la página pública y en confirmación de asistencia

**Problema:** Los eventos con `isCancelled: true` seguían visibles en `/event/[slug]` y se podía confirmar asistencia.

**ANTES** (`app/dashboard/events/_actions/event.actions.ts`):

```ts
export async function getEventBySlug(slug: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug },
    });
    return { success: true, data: event };
  } catch (error) { ... }
}

export async function getEventBySlugWithAttendanceCount(slug: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug },
      include: { _count: { select: { attendances: true } } },
    });
    if (!event) return { success: true, data: null };
    // ...
  } catch (error) { ... }
}

export async function confirmAttendance(slug: string, data: ConfirmAttendanceInput) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug },
    });
    if (!event) {
      return { success: false, error: "Evento no encontrado." };
    }
    // ...
  } catch (error) { ... }
}
```

**DESPUÉS** (`app/dashboard/events/_actions/event.actions.ts`):

```ts
export async function getEventBySlug(slug: string) {
  try {
    const event = await prisma.event.findFirst({
      where: { slug, isCancelled: false },
    });
    return { success: true, data: event };
  } catch (error) { ... }
}

export async function getEventBySlugWithAttendanceCount(slug: string) {
  try {
    const event = await prisma.event.findFirst({
      where: { slug, isCancelled: false },
      include: { _count: { select: { attendances: true } } },
    });
    if (!event) return { success: true, data: null };
    // ...
  } catch (error) { ... }
}

export async function confirmAttendance(slug: string, data: ConfirmAttendanceInput) {
  try {
    const event = await prisma.event.findFirst({
      where: { slug, isCancelled: false },
    });
    if (!event) {
      return { success: false, error: "Evento no encontrado o ha sido cancelado." };
    }
    // ...
  } catch (error) { ... }
}
```

**Resumen:** Se usa `findFirst` con `where: { slug, isCancelled: false }` en las tres funciones. Los eventos cancelados dejan de mostrarse en la página pública (notFound) y no se puede confirmar asistencia; el mensaje de error en `confirmAttendance` indica “no encontrado o cancelado”.

---

### Mejora 3: Corregir typo `createBy` → `createdBy` en la interfaz de eventos

**Problema:** La interfaz local no coincidía con el modelo Prisma ni con el resto del código.

**ANTES** (`app/dashboard/events/interfaces/event.interface.ts`):

```ts
export interface Event {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  location: string;
  imageUrl: string;
  slug: string;
  createBy: string;   // typo
  createdAt: Date;
  updatedAt: Date;
}
```

**DESPUÉS** (`app/dashboard/events/interfaces/event.interface.ts`):

```ts
export interface Event {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  location: string;
  imageUrl: string;
  slug: string;
  createdBy: string;  // alineado con Prisma y código
  createdAt: Date;
  updatedAt: Date;
}
```

**Resumen:** El contrato de la interfaz queda alineado con el modelo Prisma (`createdBy`) y con el uso en `event.actions.ts` (p. ej. `createdBy: user.name`), mejorando mantenibilidad.

---

### Mejora 4: Unificar longitud mínima de contraseña (8 caracteres)

**Problema:** Better Auth usaba `minPasswordLength: 6`, el formulario de registro validaba 8 en cliente y el placeholder decía "Mínimo 6 caracteres". Reglas y mensajes inconsistentes.

**Solución:** Se creó una única constante `MIN_PASSWORD_LENGTH = 8` en `lib/password.ts` y se usó en servidor (Better Auth) y en todos los formularios (registro y login).

**ANTES:**

- `lib/auth.ts`: `minPasswordLength: 6`
- `register-form.tsx`: `password.length < 8` y mensaje "La contraseña debe tener al menos 8 caracteres"
- `register/page.tsx`: `placeholder="Mínimo 6 caracteres"`, `minLength={6}`
- `login/page.tsx`: `minLength={6}`

**DESPUÉS:**

- **Nuevo archivo** `lib/password.ts`: exporta `MIN_PASSWORD_LENGTH = 8` y `PASSWORD_MIN_MESSAGE`.
- `lib/auth.ts`: `minPasswordLength: MIN_PASSWORD_LENGTH`
- `register-form.tsx` y `register/page.tsx`: usan `MIN_PASSWORD_LENGTH` y `PASSWORD_MIN_MESSAGE`; placeholder y `minLength` unificados a 8.
- `login/page.tsx`: `minLength={MIN_PASSWORD_LENGTH}`.
- `lib/error-messages.ts`: los mensajes "password is too short" y "password must be at least" se traducen con `PASSWORD_MIN_MESSAGE` para que el error de Better Auth coincida con el del formulario.

**Resumen:** Una sola regla (8 caracteres) en servidor y cliente; un solo lugar para cambiar la longitud en el futuro.

---

## Resumen de archivos modificados


| Archivo                                              | Cambio                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/upload/cloudinary/route.ts`                 | Validación de sesión con `auth.api.getSession` y respuesta 401 si no hay sesión.                                                          |
| `app/dashboard/events/_actions/event.actions.ts`     | Filtro `isCancelled: false` en `getEventBySlug`, `getEventBySlugWithAttendanceCount` y `confirmAttendance`; mensaje de error actualizado. |
| `app/dashboard/events/interfaces/event.interface.ts` | `createBy` → `createdBy`.                                                                                                                 |
| `lib/password.ts`                                    | **Nuevo.** Constante `MIN_PASSWORD_LENGTH = 8` y `PASSWORD_MIN_MESSAGE`.                                                                   |
| `lib/auth.ts`                                        | `minPasswordLength` usa `MIN_PASSWORD_LENGTH`.                                                                                            |
| `lib/error-messages.ts`                              | Errores de contraseña corta traducidos con `PASSWORD_MIN_MESSAGE`.                                                                         |
| `app/(auth)/register/_components/register-form.tsx`  | Validación y placeholder con `MIN_PASSWORD_LENGTH` / `PASSWORD_MIN_MESSAGE`.                                                              |
| `app/(auth)/register/page.tsx`                       | `minLength` y placeholder con `MIN_PASSWORD_LENGTH`.                                                                                      |
| `app/(auth)/login/page.tsx`                          | `minLength` con `MIN_PASSWORD_LENGTH`.                                                                                                    |


---

*Documento generado en el marco del análisis de refactorizaciones críticas del sistema.*