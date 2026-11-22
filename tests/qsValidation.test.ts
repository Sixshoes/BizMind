import { describe, it, expect } from 'vitest';
import {
  evaluateQsReadiness,
  inferCountryFromCard,
  getBoundQsSubmissionList,
  selectBestQsEmail,
} from '../utils/qsValidation';
import type { BusinessCardData } from '../types';

const sampleCard = (overrides: Partial<BusinessCardData>): BusinessCardData => ({
  id: 'q1',
  prefix: 'Prof.',
  firstName: 'Mei',
  lastName: 'Lin',
  title: 'Professor',
  company: 'National Taiwan University',
  department: 'CSIE',
  industry: 'Higher Education',
  country: '',
  email: 'info@ntu.edu.tw / meilin@ntu.edu.tw',
  phone: '+886-2-3366-3366',
  fax: '',
  subject: 'Computer Science',
  source: 'BizMind',
  website: 'https://www.ntu.edu.tw',
  address: 'Taipei, Taiwan',
  notes: '',
  category: 'academic',
  reasoning: '',
  summary: '',
  scannedAt: 1700000000000,
  syncStatus: 'local',
  ...overrides,
});

describe('qsValidation & contact completeness helpers', () => {
  it('prefers personal edu email over generic role email', () => {
    expect(selectBestQsEmail('info@ntu.edu.tw / meilin@ntu.edu.tw', 'academic')).toBe(
      'meilin@ntu.edu.tw'
    );
  });

  it('infers country from .tw domain, phone prefix, and address', () => {
    expect(inferCountryFromCard(sampleCard({}))).toBe('Taiwan SAR');
    expect(
      inferCountryFromCard(
        sampleCard({
          company: 'University of Tokyo',
          email: 'tanaka@u-tokyo.ac.jp',
          website: '',
          address: 'Tokyo',
          phone: '+81-3-1111-2222',
        })
      )
    ).toBe('Japan');
  });

  it('evaluates readiness and separates ready vs incomplete cards', () => {
    const ready = sampleCard({ id: 'ready', country: 'Taiwan SAR' });
    const incomplete = sampleCard({ id: 'inc', email: '', firstName: '', lastName: '' });
    expect(evaluateQsReadiness(ready).isReady).toBe(true);
    expect(evaluateQsReadiness(incomplete).isReady).toBe(false);

    const summary = getBoundQsSubmissionList([ready, incomplete]);
    expect(summary.readyCards.map((c) => c.id)).toEqual(['ready']);
    expect(summary.academicCards.map((c) => c.id)).toEqual(['ready']);
  });
});
