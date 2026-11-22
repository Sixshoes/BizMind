import { BusinessCardData } from '../types';

function escapeIcsText(val: string): string {
  return (val || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsUtcDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Generates an RFC 5545 .ics calendar event string for following up with a contact.
 */
export function buildFollowUpIcsContent(card: BusinessCardData, followUpAt: number): string {
  const start = new Date(followUpAt);
  // Normalize to 09:30 local time if timestamp was saved at midnight
  if (start.getHours() === 0 && start.getMinutes() === 0) {
    start.setHours(9, 30, 0, 0);
  }
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const stamp = new Date();

  const displayName =
    `${card.lastName || ''}${card.firstName || ''}`.trim() || card.company || '聯絡人';
  const summary = `跟進聯繫：${displayName}${card.company ? ` (${card.company})` : ''}`;

  const descLines = [
    `BizMind 人脈跟進提醒`,
    `聯絡人：${[card.prefix, card.lastName, card.firstName].filter(Boolean).join(' ') || displayName}`,
    card.company ? `機構/公司：${card.company}` : '',
    card.title ? `職稱：${card.title}` : '',
    card.email ? `Email：${card.email}` : '',
    card.phone ? `電話：${card.phone}` : '',
    card.notes ? `備註：${card.notes.slice(0, 300)}` : '',
  ].filter(Boolean);

  const uid = `bizmind-followup-${card.id}-${start.getTime()}@bizmind.app`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BizMind//Smart Contact Follow-Up//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtcDateTime(stamp)}`,
    `DTSTART:${formatIcsUtcDateTime(start)}`,
    `DTEND:${formatIcsUtcDateTime(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(descLines.join('\n'))}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadFollowUpIcs(card: BusinessCardData, followUpAt: number): void {
  const icsText = buildFollowUpIcsContent(card, followUpAt);
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (`${card.lastName || ''}${card.firstName || ''}` || card.company || 'contact')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
    .slice(0, 32);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BizMind_FollowUp_${safeName}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
