import { describe, it, expect } from 'vitest';
import { normalizeCountry, getCountryBilingualLabel } from '../utils/countries';

describe('countries utility', () => {
  it('normalizes Taiwan, China, Hong Kong, US, Japan aliases consistently', () => {
    expect(normalizeCountry('台灣')).toBe('Taiwan SAR');
    expect(normalizeCountry('Taiwan')).toBe('Taiwan SAR');
    expect(normalizeCountry('ROC')).toBe('Taiwan SAR');
    expect(normalizeCountry('USA')).toBe('United States');
    expect(normalizeCountry('日本')).toBe('Japan');
    expect(normalizeCountry('香港')).toBe('Hong Kong SAR');
  });

  it('returns bilingual label for known countries', () => {
    const label = getCountryBilingualLabel('Taiwan SAR');
    expect(label).toContain('Taiwan SAR');
    expect(label).toContain('台灣');
  });
});
