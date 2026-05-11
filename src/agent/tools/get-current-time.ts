import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Get the current date, time, timezone, and related temporal information.
 * A simpler, focused version of datetime_info.
 */
export const getCurrentTimeTool = tool(
  async (): Promise<string> => {
    try {
      const now = new Date();

      const lines: string[] = [];
      lines.push('Current Date and Time');
      lines.push('====================');
      lines.push('');

      // ISO 8601 formats
      lines.push('--- ISO Formats ---');
      lines.push(`  ISO 8601:       ${now.toISOString()}`);
      lines.push(`  ISO Date:       ${now.toISOString().slice(0, 10)}`);
      lines.push(`  ISO Time:       ${now.toISOString().slice(11, 19)}`);
      lines.push('');

      // Local time
      lines.push('--- Local Time ---');
      lines.push(`  Date:           ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
      lines.push(`  Time:           ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`);
      lines.push(`  Short:          ${now.toLocaleString('en-US')}`);
      lines.push(`  Day of week:    ${now.toLocaleDateString('en-US', { weekday: 'long' })} (${now.getDay()}, 0=Sun 6=Sat)`);
      lines.push(`  Day of year:    ${getDayOfYear(now)}`);
      lines.push(`  Week number:    ${getWeekNumber(now)}`);
      lines.push(`  Quarter:        Q${getQuarter(now)}`);
      lines.push('');

      // Unix timestamp
      lines.push('--- Unix Timestamp ---');
      lines.push(`  Seconds:        ${Math.floor(now.getTime() / 1000)}`);
      lines.push(`  Milliseconds:   ${now.getTime()}`);
      lines.push('');

      // Timezone info
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzOffsetMinutes = now.getTimezoneOffset();
      const tzOffsetHours = -tzOffsetMinutes / 60;
      const tzSign = tzOffsetHours >= 0 ? '+' : '';
      const tzHoursPart = Math.floor(Math.abs(tzOffsetHours));
      const tzMinsPart = Math.abs(tzOffsetMinutes % 60);

      lines.push('--- Timezone ---');
      lines.push(`  Timezone:       ${timezone}`);
      lines.push(`  UTC offset:     UTC${tzSign}${tzHoursPart}:${String(tzMinsPart).padStart(2, '0')}`);
      lines.push(`  UTC offset (min): ${tzOffsetMinutes}`);
      lines.push('');

      // UTC time
      lines.push('--- UTC ---');
      lines.push(`  UTC time:       ${now.toISOString().slice(11, 19)} UTC`);
      lines.push(`  UTC date:       ${now.toISOString().slice(0, 10)}`);
      lines.push('');

      // Additional info
      const isLeapYear = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysInYear = isLeapYear ? 366 : 365;

      lines.push('--- Additional ---');
      lines.push(`  Leap year:      ${isLeapYear ? 'Yes' : 'No'}`);
      lines.push(`  Days in month:  ${daysInMonth}`);
      lines.push(`  Days in year:   ${daysInYear}`);
      lines.push(`  Year progress:  ${((Number(getDayOfYear(now)) / Number(daysInYear)) * 100).toFixed(1)}%`);

      return lines.join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Error getting current time: ${msg}`;
    }
  },
  {
    name: 'get_current_time',
    description:
      'Get the current date, time, timezone, and calendar information. Returns ISO formats, local time, Unix timestamp, timezone details, UTC time, leap year status, and year progress. No input required.',
    schema: z.object({}),
  }
);

function getDayOfYear(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return `${dayOfYear} of 365/366`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}
