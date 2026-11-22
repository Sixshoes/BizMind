import { describe, it, expect } from 'vitest';
import { buildFollowUpIcsContent } from '../utils/icsExport';
import type { BusinessCardData } from '../types';

describe('icsExport', () => {
  it('generates RFC 5545 VCALENDAR event with contact details and alarm', () => {
    const card: BusinessCardData = {
      id: 'card-ics-1',
      prefix: '',
      firstName: 'Claire',
      lastName: 'Lin',
      title: 'ESG Director',
      company: 'StarGreen Tech',
      department: '',
      industry: '',
      country: 'Taiwan SAR',
      email: 'claire@stargreen.tw',
      phone: '0912-345-678',
      fax: '',
      subject: '',
      source: 'Summit 2026',
      website: '',
      address: '',
      notes: 'Follow up on solar pilot',
      category: 'employer',
      reasoning: '',
      summary: '',
      scannedAt: 1700000000000,
      syncStatus: 'local',
    };

    const ics = buildFollowUpIcsContent(card, new Date('2026-12-01T00:00:00').getTime());
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:跟進聯繫：LinClaire (StarGreen Tech)');
    expect(ics).toContain('claire@stargreen.tw');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('END:VCALENDAR');
  });
});
