import { describe, it, expect } from 'vitest';
import {
  resolveBilingualPair,
  detectDualSideConflict,
  applyDualSideMerge,
  splitDualSideIntoTwoCards,
} from '../utils/dualSideCardUtils';
import type { BusinessCardData, BackSideExtractionResult } from '../types';

const frontCard: BusinessCardData = {
  id: 'front-1',
  prefix: '',
  firstName: '大明',
  lastName: '林',
  title: '總經理',
  company: '星辰科技股份有限公司',
  department: '',
  industry: 'Tech',
  country: 'Taiwan SAR',
  email: 'daming@star.tw',
  phone: '02-2345-6789',
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
  imageUrl: 'https://img/front.jpg',
  backImageUrl: 'https://img/back.jpg',
};

describe('dualSideCardUtils', () => {
  it('promotes English to primary and keeps Chinese in translation', () => {
    const res = resolveBilingualPair('總經理', '', 'General Manager', '');
    expect(res.primary).toBe('General Manager');
    expect(res.translation).toBe('總經理');
    expect(res.promotedEnglish).toBe(true);
  });

  it('merges bilingual mirror cleanly without conflict', () => {
    const extraction: BackSideExtractionResult = {
      relationType: 'bilingual_mirror',
      hasDifferentTitle: false,
      hasDifferentOrg: false,
      hasDifferentPerson: false,
      backOnly: {
        firstName: 'David',
        lastName: 'Lin',
        title: 'General Manager',
        company: 'Star Tech Co., Ltd.',
        website: 'https://star.tw',
      },
    };
    const conflict = detectDualSideConflict(frontCard, extraction);
    expect(conflict.hasConflict).toBe(false);

    const { updatedCard } = applyDualSideMerge(frontCard, extraction, 'auto');
    expect(updatedCard.company).toBe('Star Tech Co., Ltd.');
    expect(updatedCard.translations?.company).toBe('星辰科技股份有限公司');
    expect(updatedCard.website).toBe('https://star.tw');
  });

  it('detects conflict and supports splitting different entities into two cards', () => {
    const extraction: BackSideExtractionResult = {
      relationType: 'different_entity',
      hasDifferentTitle: true,
      hasDifferentOrg: true,
      hasDifferentPerson: false,
      conflictSummary: '反面為另一間協會之理事長頭銜',
      backOnly: {
        firstName: 'David',
        lastName: 'Lin',
        title: 'Chairman',
        company: 'Taiwan Green Association',
        email: 'chair@tga.org.tw',
      },
    };
    const conflict = detectDualSideConflict(frontCard, extraction);
    expect(conflict.hasConflict).toBe(true);

    const { cleanedFrontCard, newBackCard } = splitDualSideIntoTwoCards(frontCard, extraction);
    expect(cleanedFrontCard.backImageUrl).toBeUndefined();
    expect(newBackCard.company).toBe('Taiwan Green Association');
    expect(newBackCard.imageUrl).toBe('https://img/back.jpg');
  });
});
