
import { BusinessCardData } from '../types';
import { normalizeCountry } from './countries';

export interface FilterIntent {
  searchText?: string;
  category?: 'all' | 'employer' | 'academic' | 'staff' | 'other';
  country?: string;
  requireEmail?: boolean;
  requirePhone?: boolean;
  intentType?: 'card_search' | 'general_chat';
}

/**
 * Single source of truth for card filtering logic
 */
export const filterCards = (cards: BusinessCardData[], intent: FilterIntent): BusinessCardData[] => {
  const { searchText, category, country, requireEmail, requirePhone } = intent;
  const q = searchText?.toLowerCase().trim() || '';

  return cards.filter(c => {
    // 1. Text Search (supports multiple terms separated by spaces, combined names, and cross-field matching)
    let matchText = true;
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        let cardSearchIndex = '';
        if (c.firstName) cardSearchIndex += ' ' + String(c.firstName).toLowerCase();
        if (c.lastName) cardSearchIndex += ' ' + String(c.lastName).toLowerCase();
        
        // Include combined name options to facilitate searching full names
        if (c.firstName && c.lastName) {
          cardSearchIndex += ' ' + `${c.firstName}${c.lastName}`.toLowerCase();
          cardSearchIndex += ' ' + `${c.lastName}${c.firstName}`.toLowerCase();
          cardSearchIndex += ' ' + `${c.firstName} ${c.lastName}`.toLowerCase();
          cardSearchIndex += ' ' + `${c.lastName} ${c.firstName}`.toLowerCase();
        }
        
        if (c.company) cardSearchIndex += ' ' + String(c.company).toLowerCase();
        if (c.email) cardSearchIndex += ' ' + String(c.email).toLowerCase();
        if (c.phone) cardSearchIndex += ' ' + String(c.phone).toLowerCase();
        if (c.title) cardSearchIndex += ' ' + String(c.title).toLowerCase();
        if (c.summary) cardSearchIndex += ' ' + String(c.summary).toLowerCase();
        if (c.reasoning) cardSearchIndex += ' ' + String(c.reasoning).toLowerCase();
        if (c.notes) cardSearchIndex += ' ' + String(c.notes).toLowerCase();
        if (c.department) cardSearchIndex += ' ' + String(c.department).toLowerCase();
        if (c.industry) cardSearchIndex += ' ' + String(c.industry).toLowerCase();
        if (c.subject) cardSearchIndex += ' ' + String(c.subject).toLowerCase();
        if (c.address) cardSearchIndex += ' ' + String(c.address).toLowerCase();
        if (c.country) {
          cardSearchIndex += ' ' + String(c.country).toLowerCase();
          const norm = normalizeCountry(c.country).toLowerCase();
          if (norm) cardSearchIndex += ' ' + norm;
        }
        if (c.translations?.country) {
          cardSearchIndex += ' ' + String(c.translations.country).toLowerCase();
          const transNorm = normalizeCountry(c.translations.country).toLowerCase();
          if (transNorm) cardSearchIndex += ' ' + transNorm;
        }

        // Every term of the search query must be found somewhere in the card's search index
        matchText = terms.every(term => cardSearchIndex.includes(term));
      }
    }

    // 2. Category Filter
    const matchCat = !category || category === 'all' || c.category === category;

    // 3. Country Filter
    let matchCountry = true;
    if (country && country !== 'all') {
      if (country === '__empty__') {
        matchCountry = !c.country?.trim() && !c.translations?.country?.trim();
      } else {
        const target = country.toLowerCase().trim();
        const normTarget = normalizeCountry(country).toLowerCase();
        const cardCountry = (c.country || '').toLowerCase().trim();
        const normCard = normalizeCountry(c.country).toLowerCase();
        const transCountry = (c.translations?.country || '').toLowerCase().trim();
        const normTrans = normalizeCountry(c.translations?.country).toLowerCase();
        
        matchCountry = 
          cardCountry === target || 
          transCountry === target || 
          (normCard && normCard === normTarget) || 
          (normTrans && normTrans === normTarget);
      }
    }

    // 4. Requirement Filters
    const matchEmail = !requireEmail || !!c.email;
    const matchPhone = !requirePhone || !!c.phone;

    return matchText && matchCat && matchCountry && matchEmail && matchPhone;
  });
};
