import { describe, it, expect } from 'vitest';
import { analyzeDuplicates, mergeDuplicateCards } from '../utils/duplicateUtils';
import type { BusinessCardData } from '../types';

const baseCard = (overrides: Partial<BusinessCardData>): BusinessCardData => ({
  id: 'card-1',
  prefix: '',
  firstName: 'Alice',
  lastName: 'Wang',
  title: 'VP of Engineering',
  company: 'Future Labs',
  department: '',
  industry: '',
  country: 'Taiwan SAR',
  email: 'alice@futurelabs.io',
  phone: '0912345678',
  fax: '',
  subject: '',
  source: 'BizMind',
  website: '',
  address: '',
  notes: '',
  category: 'employer',
  reasoning: '',
  summary: '',
  scannedAt: 1700000000000,
  syncStatus: 'local',
  ...overrides,
});

describe('duplicateUtils', () => {
  it('groups duplicate cards with same email/name/company and recommends highest-quality primary', () => {
    const rich = baseCard({ id: 'rich', imageUrl: 'https://img/1.jpg', summary: 'Complete bio', tags: ['VIP'] });
    const sparse = baseCard({ id: 'sparse', title: '', summary: '', notes: 'Met at booth B2', tags: ['Booth'] });
    const other = baseCard({ id: 'other', firstName: 'Bob', email: 'bob@other.com', company: 'Other Co' });

    const result = analyzeDuplicates([sparse, rich, other]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].primaryCardId).toBe('rich');
    expect(result.totalDuplicateCount).toBe(1);

    const merged = mergeDuplicateCards(rich, [sparse]);
    expect(merged.notes).toContain('Met at booth B2');
    expect(merged.tags).toEqual(expect.arrayContaining(['VIP', 'Booth']));
  });

  it('does not merge two contacts with distinct emails even if same name', () => {
    const a = baseCard({ id: 'a', email: 'alice@company-a.com' });
    const b = baseCard({ id: 'b', email: 'alice@company-b.com' });
    const result = analyzeDuplicates([a, b]);
    expect(result.groups).toHaveLength(0);
  });
});
