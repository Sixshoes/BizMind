import { describe, it, expect } from 'vitest';
import { isVCardOrMeCard, parseContactQrPayload } from '../utils/vcardParser';

describe('vcardParser', () => {
  it('parses standard vCard 3.0 payload accurately', () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Chen;Yiting;;Dr.;',
      'FN:Dr. Yiting Chen',
      'ORG:Fo Guang University;International Office',
      'TITLE:Director',
      'TEL;TYPE=WORK,VOICE:+886-3-987-1000',
      'TEL;TYPE=FAX:+886-3-987-2000',
      'EMAIL:yiting@fgu.edu.tw',
      'URL:https://www.fgu.edu.tw',
      'ADR;TYPE=WORK:;;160 Linwei Rd;Jiaoxi;Yilan;262;Taiwan',
      'END:VCARD',
    ].join('\r\n');

    expect(isVCardOrMeCard(vcard)).toBe(true);
    const parsed = parseContactQrPayload(vcard);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('Dr.');
    expect(parsed?.lastName).toBe('Chen');
    expect(parsed?.firstName).toBe('Yiting');
    expect(parsed?.company).toBe('Fo Guang University');
    expect(parsed?.department).toBe('International Office');
    expect(parsed?.title).toBe('Director');
    expect(parsed?.email).toBe('yiting@fgu.edu.tw');
    expect(parsed?.phone).toBe('+886-3-987-1000');
    expect(parsed?.fax).toBe('+886-3-987-2000');
    expect(parsed?.country).toBe('Taiwan SAR');
  });

  it('parses MeCard QR payload accurately', () => {
    const mecard = 'MECARD:N:Tanaka,Kenji;ORG:Kyoto Lab;TITLE:Researcher;TEL:+81-75-123-4567;EMAIL:kenji@kyoto.jp;URL:https://kyoto.jp;;';
    expect(isVCardOrMeCard(mecard)).toBe(true);
    const parsed = parseContactQrPayload(mecard);
    expect(parsed?.lastName).toBe('Tanaka');
    expect(parsed?.firstName).toBe('Kenji');
    expect(parsed?.company).toBe('Kyoto Lab');
    expect(parsed?.email).toBe('kenji@kyoto.jp');
  });

  it('returns null for arbitrary non-contact QR strings', () => {
    expect(isVCardOrMeCard('https://example.com')).toBe(false);
    expect(parseContactQrPayload('https://example.com')).toBeNull();
  });
});
