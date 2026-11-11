/**
 * RCA2.O Universal Time & Date Formatting Utilities
 *
 * Guarantees that ALL time representations across the application
 * are strictly formatted in 12-hour AM/PM format (e.g. "09:30 AM", "02:15 PM").
 * 24-hour military format is never presented in the user interface.
 */

/**
 * Converts any time string (e.g. "09:00", "14:30", "14:30:00", "2:15 PM")
 * into a normalized 12-hour AM/PM formatted string (e.g. "09:00 AM", "02:30 PM").
 */
export function formatTime12h(timeStr?: string | null, fallbackTime = ''): string {
  const effective = (timeStr || fallbackTime || '').trim();
  if (!effective) return '';

  // If already contains AM or PM (case-insensitive)
  if (/\b(AM|PM)\b/i.test(effective)) {
    return effective.toUpperCase();
  }

  // Handle ISO string or date with time (e.g. 2026-11-03T14:30:00Z)
  if (effective.includes('T') || (effective.includes('-') && effective.length > 10)) {
    const d = new Date(effective);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }

  const parts = effective.split(':');
  if (parts.length < 2) return effective;

  let hours = parseInt(parts[0], 10);
  const minutes = (parts[1] || '00').slice(0, 2).padStart(2, '0');
  if (isNaN(hours)) return effective;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const hh = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hh}:${minutes} ${ampm}`;
}

/**
 * Formats a Date object or timestamp into 12-hour AM/PM time only (e.g. "09:30 AM").
 */
export function formatTimeOnly12h(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a Date object or timestamp into a combined date and 12-hour AM/PM string
 * (e.g. "03 Nov 2026, 02:30 PM").
 */
export function formatDateTime12h(
  dateInput?: string | number | Date | null,
  options?: { includeSeconds?: boolean }
): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const formatted = d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(options?.includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  });

  // Normalize am/pm to uppercase AM/PM
  return formatted.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}
