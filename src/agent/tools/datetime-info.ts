import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * datetime_info - Get the current date, time, timezone, and calendar information.
 */
export const datetimeInfoTool = tool(
  async (): Promise<string> => {
    try {
      const now = new Date();

      const dateInfo = {
        full: now.toString(),
        iso: now.toISOString(),
        utc: now.toUTCString(),
        date: now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utcOffset: `UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(Math.floor(now.getTimezoneOffset() / 60))}`,
        unixTimestamp: Math.floor(now.getTime() / 1000),
        millisecondTimestamp: now.getTime(),
        dayOfYear: Math.ceil(
          (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)
        ),
        weekNumber: Math.ceil(
          ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1
        ),
        isLeapYear: (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0,
        daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        daysInYear: ((now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0) ? 366 : 365,
        quarter: Math.ceil((now.getMonth() + 1) / 3),
      };

      return `Current Date and Time Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Date:        ${dateInfo.date}
🕐 Time:        ${dateInfo.time}
🌍 Timezone:    ${dateInfo.timezone} (${dateInfo.utcOffset})
📌 ISO Format:  ${dateInfo.iso}
📌 UTC Format:  ${dateInfo.utc}
📌 Full Format: ${dateInfo.full}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Calendar Info:
   • Day of year:     ${dateInfo.dayOfYear} of ${dateInfo.daysInYear}
   • Week number:     ${dateInfo.weekNumber}
   • Quarter:         Q${dateInfo.quarter}
   • Days in month:   ${dateInfo.daysInMonth}
   • Is leap year:    ${dateInfo.isLeapYear}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔢 Timestamps:
   • Unix (seconds):  ${dateInfo.unixTimestamp}
   • Unix (ms):       ${dateInfo.millisecondTimestamp}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error getting date/time info: ${msg}`;
    }
  },
  {
    name: 'datetime_info',
    description:
      'Get the current date, time, timezone, and calendar information. No input required.',
    schema: z.object({}),
  }
);
