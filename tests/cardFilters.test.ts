import { describe, it, expect } from 'vitest';
import { filterCards } from '../utils/cardFilters';
import type { BusinessCardData } from '../types';

const makeCard = (overrides: Partial<BusinessCardData>): BusinessCardData => ({
  id: 'c1',
  prefix: '',
  firstName: 'Ming',
  lastName: 'Chen',
  title: 'CTO',
  company: 'GreenTech Inc.',
  department: '',
  industry: 'CleanTech',
  country: 'Taiwan SAR',
  email: 'ming@greentech.tw',
  phone: '+886-912-345-678',
  fax: '',
  subject: '',
  source: '2026 Sustainability Summit',
  website: 'https://greentech.tw',
  address: 'Taipei',
  notes: 'Interested in ESG partnership',
  tags: ['ESG', 'VIP'],
  category: 'employer',
  reasoning: '',
  summary: 'CleanTech leader',
  scannedAt: 1700000000000,
  syncStatus: 'firebase',
  ...overrides,
});

describe('filterCards multi-dimensional filtering', () => {
  const cards = [
    makeCard({ id: '1', firstName: 'Ming', lastName: 'Chen', category: 'employer', country: 'Taiwan SAR', tags: ['ESG'] }),
    makeCard({
      id: '2',
      firstName: 'Kenji',
      lastName: 'Sato',
      company: 'Tokyo University',
      category: 'academic',
      country: 'Japan',
      email: '',
      phone: '+81-3-1234-5678',
      tags: ['AI'],
      source: 'Academic Forum',
      backImageUrl: 'https://example.com/back.jpg',
    }),
  ];

  it('filters by category, country alias, tag, source and boolean flags', () => {
    expect(filterCards(cards, { category: 'academic' }).map((c) => c.id)).toEqual(['2']);
    expect(filterCards(cards, { country: '日本' }).map((c) => c.id)).toEqual(['2']);
    expect(filterCards(cards, { requireEmail: true }).map((c) => c.id)).toEqual(['1']);
    expect(filterCards(cards, { requireBackImage: true }).map((c) => c.id)).toEqual(['2']);
    expect(filterCards(cards, { tag: 'ESG' }).map((c) => c.id)).toEqual(['1']);
    expect(filterCards(cards, { source: 'Academic Forum' }).map((c) => c.id)).toEqual(['2']);
  });

  it('supports multi-term fuzzy search across name, phone digits, and company', () => {
    expect(filterCards(cards, { searchText: 'greentech 0912' })).toHaveLength(0);
    expect(filterCards(cards, { searchText: 'greentech 886912' }).map((c) => c.id)).toEqual(['1']);
    expect(filterCards(cards, { searchText: 'tokyo sato' }).map((c) => c.id)).toEqual(['2']);
  });
});
