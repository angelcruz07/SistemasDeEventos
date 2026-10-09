/** Provider errors and logs can echo recipients; never log addresses. */
export function redactEmails(message: string): string {
  return message.replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[email]");
}
