import { BusinessCardData } from '../types';
import { normalizeCountry } from './countries';

export function isVCardOrMeCard(raw: string): boolean {
  const trimmed = (raw || '').trim();
  return /^BEGIN:VCARD/i.test(trimmed) || /^MECARD:/i.test(trimmed);
}

function unescapeVCardValue(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function unfoldVCardLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else if (line.trim()) {
      unfolded.push(line.trim());
    }
  }
  return unfolded;
}

function parseVCard(raw: string): Partial<BusinessCardData> {
  const lines = unfoldVCardLines(raw);
  let prefix = '';
  let firstName = '';
  let lastName = '';
  let fullName = '';
  let company = '';
  let department = '';
  let title = '';
  const phones: string[] = [];
  const faxes: string[] = [];
  const emails: string[] = [];
  let website = '';
  let address = '';
  let country = '';
  let notes = '';

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;

    const left = line.slice(0, colonIdx).toUpperCase();
    const value = unescapeVCardValue(line.slice(colonIdx + 1));
    if (!value) continue;

    const [propName, ...params] = left.split(';');
    const paramStr = params.join(';');

    switch (propName) {
      case 'N': {
        const parts = value.split(';').map((s) => s.trim());
        lastName = parts[0] || lastName;
        firstName = parts[1] || firstName;
        if (parts[3]) prefix = parts[3];
        break;
      }
      case 'FN':
        fullName = value;
        break;
      case 'ORG': {
        const orgParts = value.split(';').map((s) => s.trim()).filter(Boolean);
        company = orgParts[0] || company;
        if (orgParts.length > 1) department = orgParts.slice(1).join(' / ');
        break;
      }
      case 'TITLE':
        title = value;
        break;
      case 'TEL':
        if (paramStr.includes('FAX')) {
          faxes.push(value);
        } else {
          phones.push(value);
        }
        break;
      case 'EMAIL':
        emails.push(value);
        break;
      case 'URL':
        if (!website) website = value;
        break;
      case 'ADR': {
        const adrParts = value.split(';').map((s) => s.trim());
        const countryPart = adrParts[6] || '';
        if (countryPart && !country) {
          country = normalizeCountry(countryPart);
        }
        const cleanedAddr = adrParts.filter(Boolean).join(', ');
        if (cleanedAddr && !address) address = cleanedAddr;
        break;
      }
      case 'NOTE':
        notes = notes ? `${notes}\n${value}` : value;
        break;
      default:
        break;
    }
  }

  if (!firstName && !lastName && fullName) {
    const tokens = fullName.trim().split(/\s+/);
    if (tokens.length >= 2) {
      firstName = tokens[0];
      lastName = tokens.slice(1).join(' ');
    } else if (/^[\u4e00-\u9fff]{2,4}$/.test(fullName)) {
      lastName = fullName.slice(0, 1);
      firstName = fullName.slice(1);
    } else {
      firstName = fullName;
    }
  }

  return {
    prefix,
    firstName,
    lastName,
    title,
    company,
    department,
    country,
    email: Array.from(new Set(emails)).join(' / '),
    phone: Array.from(new Set(phones)).join(' / '),
    fax: Array.from(new Set(faxes)).join(' / '),
    website,
    address,
    notes,
  };
}

function parseMeCard(raw: string): Partial<BusinessCardData> {
  const body = raw.trim().replace(/^MECARD:/i, '');
  const tokens = body.split(';').filter(Boolean);
  let firstName = '';
  let lastName = '';
  let company = '';
  let title = '';
  const phones: string[] = [];
  const emails: string[] = [];
  let website = '';
  let address = '';
  let notes = '';

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = token.slice(0, colonIdx).toUpperCase();
    const val = unescapeVCardValue(token.slice(colonIdx + 1));
    if (!val) continue;

    switch (key) {
      case 'N': {
        const parts = val.split(',').map((s) => s.trim());
        lastName = parts[0] || '';
        firstName = parts[1] || '';
        break;
      }
      case 'ORG':
        company = val;
        break;
      case 'TITLE':
        title = val;
        break;
      case 'TEL':
        phones.push(val);
        break;
      case 'EMAIL':
        emails.push(val);
        break;
      case 'URL':
        website = val;
        break;
      case 'ADR':
        address = val.split(',').map((s) => s.trim()).filter(Boolean).join(', ');
        break;
      case 'NOTE':
        notes = val;
        break;
      default:
        break;
    }
  }

  return {
    firstName,
    lastName,
    title,
    company,
    email: Array.from(new Set(emails)).join(' / '),
    phone: Array.from(new Set(phones)).join(' / '),
    website,
    address,
    notes,
  };
}

/**
 * Parses a QR code or pasted vCard / MeCard payload into structured BusinessCardData fields.
 * Returns null if the string is not a recognized contact payload or contains no useful info.
 */
export function parseContactQrPayload(raw: string): Partial<BusinessCardData> | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  let parsed: Partial<BusinessCardData> | null = null;
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    parsed = parseVCard(trimmed);
  } else if (/^MECARD:/i.test(trimmed)) {
    parsed = parseMeCard(trimmed);
  }

  if (!parsed) return null;

  const hasAnySignal = Boolean(
    parsed.firstName || parsed.lastName || parsed.company || parsed.email || parsed.phone
  );
  return hasAnySignal ? parsed : null;
}
