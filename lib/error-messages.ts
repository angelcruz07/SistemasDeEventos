/**
 * Traduce mensajes de error en inglés (p. ej. de Better Auth o Prisma) al español
 * para mostrarlos al usuario.
 */

const AUTH_ERROR_MAP: Record<string, string> = {
  "invalid credentials": "Credenciales incorrectas",
  "invalid email or password": "Correo o contraseña incorrectos",
  "invalid email or password.": "Correo o contraseña incorrectos",
  "wrong password": "Contraseña incorrecta",
  "invalid password": "Contraseña incorrecta",
  "email already in use": "Este correo ya está registrado",
  "user already exists": "Este correo ya está registrado",
  "email already exists": "Este correo ya está registrado",
  "account already exists": "Ya existe una cuenta con este correo",
  "password is too short": "La contraseña es demasiado corta",
  "password must be at least": "La contraseña debe tener al menos",
  "invalid email": "Correo electrónico no válido",
  "user not found": "Usuario no encontrado",
  "email not found": "Correo no encontrado",
  "account not found": "Cuenta no encontrada",
  "session expired": "La sesión ha expirado",
  "invalid session": "Sesión no válida",
  "too many requests": "Demasiados intentos. Espera un momento.",
  "rate limit": "Demasiados intentos. Espera un momento.",
  "network error": "Error de conexión. Comprueba tu internet.",
  "failed to fetch": "Error de conexión. Comprueba tu internet.",
};

const SERVER_ERROR_MAP: Record<string, string> = {
  "record to update not found": "No encontrado",
  "record to delete not found": "No encontrado",
  "record not found": "No encontrado",
  "no record found": "No encontrado",
  "unique constraint": "Ya existe un registro con esos datos",
  "foreign key constraint": "No se puede completar la operación",
  "connection": "Error de conexión con la base de datos",
  "econnrefused": "No se puede conectar a la base de datos",
  "can't reach": "No se puede conectar al servidor",
  "invalid": "Datos no válidos",
  "timeout": "Tiempo de espera agotado",
  "network": "Error de red",
};

function normalizeMessage(msg: string): string {
  return msg.trim().toLowerCase();
}

/**
 * Traduce mensajes de error de autenticación (Better Auth, etc.) al español.
 * Si el mensaje no está en el mapa, se devuelve un mensaje genérico en español.
 */
export function authErrorToSpanish(message: string | undefined | null): string {
  if (!message || typeof message !== "string") return "Error al procesar la solicitud";
  const normalized = normalizeMessage(message);
  for (const [en, es] of Object.entries(AUTH_ERROR_MAP)) {
    if (normalized.includes(en)) return es;
  }
  return "Error al procesar la solicitud";
}

/**
 * Traduce mensajes de error del servidor (Prisma, BD, etc.) al español.
 * Si no hay coincidencia, devuelve fallback.
 */
export function serverErrorToSpanish(message: string | undefined | null, fallback: string): string {
  if (!message || typeof message !== "string") return fallback;
  const normalized = normalizeMessage(message);
  for (const [en, es] of Object.entries(SERVER_ERROR_MAP)) {
    if (normalized.includes(en)) return es;
  }
  return fallback;
}
