import { BusinessCardData } from '../types';
import { normalizeCountry, getCountryChineseName } from './countries';

export interface FilterIntent {
  searchText?: string;
  category?: 'all' | 'employer' | 'academic' | 'staff' | 'other';
  country?: string;
  requireEmail?: boolean;
  requirePhone?: boolean;
  intentType?: 'card_search' | 'general_chat';
}

interface CachedCardIndex {
  searchIndex: string;
  rawCountryLower: string;
  normCountryLower: string;
  rawTransCountryLower: string;
  normTransCountryLower: string;
  isCountryEmpty: boolean;
}

const cardIndexCache = new WeakMap<BusinessCardData, CachedCardIndex>();

const getCardIndex = (c: BusinessCardData): CachedCardIndex => {
  const existing = cardIndexCache.get(c);
  if (existing) return existing;

  const parts: string[] = [];
  if (c.firstName) parts.push(String(c.firstName));
  if (c.lastName) parts.push(String(c.lastName));

  if (c.firstName && c.lastName) {
    parts.push(
      `${c.firstName}${c.lastName}`,
      `${c.lastName}${c.firstName}`,
      `${c.firstName} ${c.lastName}`,
      `${c.lastName} ${c.firstName}`
    );
  }

  if (c.company) parts.push(String(c.company));
  if (c.email) parts.push(String(c.email));
  if (c.phone) parts.push(String(c.phone));
  if (c.title) parts.push(String(c.title));
  if (c.summary) parts.push(String(c.summary));
  if (c.reasoning) parts.push(String(c.reasoning));
  if (c.notes) parts.push(String(c.notes));
  if (c.department) parts.push(String(c.department));
  if (c.industry) parts.push(String(c.industry));
  if (c.subject) parts.push(String(c.subject));
  if (c.address) parts.push(String(c.address));

  const rawCountry = (c.country || '').trim();
  const rawTransCountry = (c.translations?.country || '').trim();
  const normCountry = rawCountry ? normalizeCountry(rawCountry) : '';
  const normTransCountry = rawTransCountry ? normalizeCountry(rawTransCountry) : '';

  if (rawCountry) parts.push(rawCountry);
  if (normCountry) {
    parts.push(normCountry);
    const zh = getCountryChineseName(normCountry);
    if (zh) parts.push(zh);
  }
  if (rawTransCountry) parts.push(rawTransCountry);
  if (normTransCountry) {
    parts.push(normTransCountry);
    const transZh = getCountryChineseName(normTransCountry);
    if (transZh) parts.push(transZh);
  }

  const built: CachedCardIndex = {
    searchIndex: parts.join(' ').toLowerCase(),
    rawCountryLower: rawCountry.toLowerCase(),
    normCountryLower: normCountry.toLowerCase(),
    rawTransCountryLower: rawTransCountry.toLowerCase(),
    normTransCountryLower: normTransCountry.toLowerCase(),
    isCountryEmpty: !rawCountry && !rawTransCountry,
  };

  cardIndexCache.set(c, built);
  return built;
};

/**
 * Single source of truth for card filtering logic (WeakMap-indexed for O(1) per-card index reuse)
 */
export const filterCards = (cards: BusinessCardData[], intent: FilterIntent): BusinessCardData[] => {
  const { searchText, category, country, requireEmail, requirePhone } = intent;
  const q = searchText?.toLowerCase().trim() || '';
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];
  const hasTerms = terms.length > 0;
  const checkCat = Boolean(category && category !== 'all');
  const checkCountry = Boolean(country && country !== 'all');
  const isEmptyCountryFilter = country === '__empty__';
  const targetCountryLower = checkCountry && !isEmptyCountryFilter ? country!.toLowerCase().trim() : '';
  const normTargetCountryLower = checkCountry && !isEmptyCountryFilter ? normalizeCountry(country!).toLowerCase() : '';

  if (!hasTerms && !checkCat && !checkCountry && !requireEmail && !requirePhone) {
    return cards;
  }

  return cards.filter(c => {
    if (checkCat && c.category !== category) return false;
    if (requireEmail && !c.email) return false;
    if (requirePhone && !c.phone) return false;

    if (!hasTerms && !checkCountry) return true;

    const idx = getCardIndex(c);

    if (checkCountry) {
      if (isEmptyCountryFilter) {
        if (!idx.isCountryEmpty) return false;
      } else {
        const matchCountry =
          idx.rawCountryLower === targetCountryLower ||
          idx.rawTransCountryLower === targetCountryLower ||
          (idx.normCountryLower !== '' && idx.normCountryLower === normTargetCountryLower) ||
          (idx.normTransCountryLower !== '' && idx.normTransCountryLower === normTargetCountryLower);
        if (!matchCountry) return false;
      }
    }

    if (hasTerms) {
      for (let i = 0; i < terms.length; i++) {
        if (!idx.searchIndex.includes(terms[i])) return false;
      }
    }

    return true;
  });
};
