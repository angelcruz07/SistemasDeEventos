/**
 * Longitud mínima de contraseña. Usada por Better Auth (servidor) y por
 * formularios de registro/login (cliente) para mantener una única regla.
 */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_MIN_MESSAGE = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
