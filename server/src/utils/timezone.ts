// =============================================================================
// Timezone Utility Functions
// =============================================================================

/**
 * Regex to detect whether an ISO-like datetime string carries explicit
 * timezone information (trailing "Z" or a ±HH:MM / ±HHMM offset).
 */
const HAS_TZ_OFFSET_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Check if a datetime string includes explicit timezone information.
 */
export function hasTimezoneInfo(dateString: string): boolean {
  return HAS_TZ_OFFSET_REGEX.test(dateString.trim());
}

/**
 * Get the UTC offset (in milliseconds) of a timezone at a given instant.
 * Positive values mean the timezone is ahead of UTC (e.g. +08:00).
 */
export function getTimezoneOffsetMs(timeZone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    }
    // "hour24" can come back as "24" for midnight in some environments
    const hour = values.hour === '24' ? '00' : values.hour;
    const asUTC = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(hour),
      Number(values.minute),
      Number(values.second)
    );
    return asUTC - date.getTime();
  } catch {
    // Unknown/invalid timezone - fall back to no offset
    return 0;
  }
}

/**
 * Parse a datetime string into a Date, interpreting strings WITHOUT explicit
 * timezone information as wall-clock local time in the given timezone.
 *
 * - "2026-07-24T14:00:00Z"        -> parsed as UTC (standard behavior)
 * - "2026-07-24T14:00:00+08:00"   -> parsed with its offset (standard behavior)
 * - "2026-07-24T14:00:00" + "Asia/Hong_Kong" -> 14:00 in Asia/Hong_Kong (= 06:00 UTC)
 *
 * This ensures times provided by the LLM (which are local wall-clock times)
 * are anchored to the user's timezone instead of drifting to UTC/server time.
 */
export function parseInTimezone(dateString: string, timeZone: string): Date {
  const trimmed = (dateString || '').trim();

  // If the string already carries timezone info, or we don't have a valid
  // timezone to interpret against, defer to the native Date parser.
  if (!trimmed || hasTimezoneInfo(trimmed) || !isValidTimezone(timeZone)) {
    return new Date(trimmed);
  }

  // Parse the wall-clock components as if they were UTC first...
  const naive = new Date(`${trimmed}Z`);
  if (isNaN(naive.getTime())) {
    return new Date(trimmed);
  }

  // ...then shift by the timezone's offset so the wall-clock time is
  // preserved in the target timezone.
  const offsetMs = getTimezoneOffsetMs(timeZone, naive);
  return new Date(naive.getTime() - offsetMs);
}

/**
 * Validate an IANA timezone identifier.
 */
export function isValidTimezone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
