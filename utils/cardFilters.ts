import { BusinessCardData } from '../types';
import { normalizeCountry } from './countries';

export interface FilterIntent {
  searchText?: string;
  category?: 'all' | 'employer' | 'academic' | 'staff' | 'other';
  country?: string;
  tag?: string;
  source?: string;
  requireEmail?: boolean;
  requirePhone?: boolean;
  requireBackImage?: boolean;
  intentType?: 'card_search' | 'general_chat';
}

// WeakMap cache avoids rebuilding search strings on every render/keystroke while automatically garbage-collecting replaced card objects
const cardSearchIndexCache = new WeakMap<BusinessCardData, string>();
const cardNormalizedCountryCache = new WeakMap<BusinessCardData, string>();

export const getCardSearchIndex = (c: BusinessCardData): string => {
  const cached = cardSearchIndexCache.get(c);
  if (cached !== undefined) return cached;

  const parts: string[] = [];
  if (c.firstName) parts.push(String(c.firstName).toLowerCase());
  if (c.lastName) parts.push(String(c.lastName).toLowerCase());
  if (c.firstName && c.lastName) {
    parts.push(`${c.firstName}${c.lastName}`.toLowerCase());
    parts.push(`${c.lastName}${c.firstName}`.toLowerCase());
    parts.push(`${c.firstName} ${c.lastName}`.toLowerCase());
    parts.push(`${c.lastName} ${c.firstName}`.toLowerCase());
  }
  if (c.company) parts.push(String(c.company).toLowerCase());
  if (c.translations?.company) parts.push(String(c.translations.company).toLowerCase());
  if (c.email) parts.push(String(c.email).toLowerCase());
  if (c.phone) {
    parts.push(String(c.phone).toLowerCase());
    parts.push(String(c.phone).replace(/\D/g, ''));
  }
  if (c.title) parts.push(String(c.title).toLowerCase());
  if (c.translations?.title) parts.push(String(c.translations.title).toLowerCase());
  if (c.summary) parts.push(String(c.summary).toLowerCase());
  if (c.reasoning) parts.push(String(c.reasoning).toLowerCase());
  if (c.notes) parts.push(String(c.notes).toLowerCase());
  if (c.department) parts.push(String(c.department).toLowerCase());
  if (c.industry) parts.push(String(c.industry).toLowerCase());
  if (c.subject) parts.push(String(c.subject).toLowerCase());
  if (c.address) parts.push(String(c.address).toLowerCase());
  if (c.source) parts.push(String(c.source).toLowerCase());
  if (c.tags && c.tags.length > 0) {
    parts.push(c.tags.join(' ').toLowerCase());
  }
  if (c.country) {
    parts.push(String(c.country).toLowerCase());
    const norm = normalizeCountry(c.country).toLowerCase();
    if (norm) parts.push(norm);
  }
  if (c.translations?.country) {
    parts.push(String(c.translations.country).toLowerCase());
    const transNorm = normalizeCountry(c.translations.country).toLowerCase();
    if (transNorm) parts.push(transNorm);
  }

  const built = parts.join(' ');
  cardSearchIndexCache.set(c, built);
  return built;
};

export const getCachedNormalizedCountry = (c: BusinessCardData): string => {
  const cached = cardNormalizedCountryCache.get(c);
  if (cached !== undefined) return cached;
  const raw = (c.country || c.translations?.country || '').trim();
  const norm = raw ? normalizeCountry(raw) : '';
  cardNormalizedCountryCache.set(c, norm);
  return norm;
};

/**
 * Single source of truth for card filtering logic with WeakMap index acceleration
 */
export const filterCards = (cards: BusinessCardData[], intent: FilterIntent): BusinessCardData[] => {
  const { searchText, category, country, tag, source, requireEmail, requirePhone, requireBackImage } = intent;
  const q = searchText?.toLowerCase().trim() || '';
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];
  const normTargetCountry = country && country !== 'all' && country !== '__empty__'
    ? normalizeCountry(country).toLowerCase()
    : '';
  const rawTargetCountry = country && country !== 'all' ? country.toLowerCase().trim() : '';

  return cards.filter(c => {
    // 1. Category Filter (fast O(1) check first)
    if (category && category !== 'all' && c.category !== category) {
      return false;
    }

    // 2. Requirement Filters
    if (requireEmail && !c.email) return false;
    if (requirePhone && !c.phone) return false;
    if (requireBackImage && !c.backImageUrl) return false;

    // 3. Tag Filter
    if (tag && tag !== 'all') {
      if (!c.tags || !c.tags.includes(tag)) return false;
    }

    // 4. Source Filter
    if (source && source !== 'all') {
      if ((c.source || '').trim() !== source) return false;
    }

    // 5. Country Filter
    if (country && country !== 'all') {
      const normCard = getCachedNormalizedCountry(c).toLowerCase();
      if (country === '__empty__') {
        if (normCard || c.country?.trim() || c.translations?.country?.trim()) return false;
      } else {
        const cardCountry = (c.country || '').toLowerCase().trim();
        const transCountry = (c.translations?.country || '').toLowerCase().trim();
        const matches =
          cardCountry === rawTargetCountry ||
          transCountry === rawTargetCountry ||
          (normCard !== '' && normCard === normTargetCountry);
        if (!matches) return false;
      }
    }

    // 6. Pre-built Index Text Search
    if (terms.length > 0) {
      const idx = getCardSearchIndex(c);
      for (let i = 0; i < terms.length; i++) {
        if (!idx.includes(terms[i])) return false;
      }
    }

    return true;
  });
};
