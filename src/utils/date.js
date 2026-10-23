/**
 * Date and Timezone Utilities for Retail POS
 * Default business timezone is Asia/Dhaka (UTC+6).
 */

const DHAKA_OFFSET_HOURS = 6;
const DHAKA_OFFSET_MS = DHAKA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Returns UTC Date objects corresponding to the start and end of "today" in Asia/Dhaka timezone.
 * Start: 00:00:00.000 in Asia/Dhaka
 * End:   23:59:59.999 in Asia/Dhaka
 */
export function getDhakaTodayRange(referenceDate = new Date()) {
  const dhakaNow = new Date(referenceDate.getTime() + DHAKA_OFFSET_MS);

  const year = dhakaNow.getUTCFullYear();
  const month = dhakaNow.getUTCMonth();
  const date = dhakaNow.getUTCDate();

  const startUTC = new Date(Date.UTC(year, month, date) - DHAKA_OFFSET_MS);
  const endUTC = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - DHAKA_OFFSET_MS);

  return {
    start: startUTC,
    end: endUTC,
    timezone: "Asia/Dhaka",
  };
}
