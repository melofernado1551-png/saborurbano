/**
 * Check if a store is currently open based on opening_time and closing_time.
 * Times are in "HH:MM" format. Handles overnight ranges (e.g., 18:00 - 02:00).
 * If either time is null/undefined, the store is considered always open.
 */
export function isStoreOpen(openingTime: string | null | undefined, closingTime: string | null | undefined): boolean {
  if (!openingTime || !closingTime) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = openingTime.split(":").map(Number);
  const [closeH, closeM] = closingTime.split(":").map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes > openMinutes) {
    // Same day range (e.g., 08:00 - 22:00)
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    // Overnight range (e.g., 18:00 - 02:00)
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
}

export function formatStoreHours(openingTime: string | null | undefined, closingTime: string | null | undefined): string {
  if (!openingTime || !closingTime) return "";
  return `${openingTime} às ${closingTime}`;
}
