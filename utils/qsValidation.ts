import { BusinessCardData, CATEGORY_LABELS } from '../types';
import { normalizeCountry, STANDARD_COUNTRIES } from './countries';

export const DEFAULT_CARD_SOURCE = 'BizMind';

const STANDARD_COUNTRY_SET = new Set(STANDARD_COUNTRIES);

const GENERIC_EMAIL_PREFIXES = new Set([
  'info',
  'contact',
  'contacts',
  'service',
  'services',
  'admin',
  'administrator',
  'office',
  'support',
  'sales',
  'hello',
  'enquiry',
  'enquiries',
  'inquiry',
  'inquiries',
  'marketing',
  'hr',
  'press',
  'media',
  'general',
  'webmaster',
  'mail',
  'help',
  'admission',
  'admissions',
  'noreply',
  'no-reply',
]);

export function splitMultiValues(str?: string | null): string[] {
  if (!str) return [];
  return String(str)
    .split(/[\/\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidEmailFormat(email?: string | null): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function isGenericRoleEmail(email?: string | null): boolean {
  if (!email) return false;
  const localPart = email.trim().toLowerCase().split('@')[0] || '';
  return GENERIC_EMAIL_PREFIXES.has(localPart);
}

export function selectBestQsEmail(emailStr?: string | null, category?: string): string {
  const candidates = splitMultiValues(emailStr).filter(isValidEmailFormat);
  if (candidates.length === 0) return '';

  const personalCandidates = candidates.filter((e) => !isGenericRoleEmail(e));
  const pool = personalCandidates.length > 0 ? personalCandidates : candidates;

  if (pool.length === 1) return pool[0];

  const eduEmail = pool.find((e) => {
    const d = e.toLowerCase().split('@')[1] || '';
    return d.includes('.edu') || d.includes('.ac.');
  });
  const nonEduEmail = pool.find((e) => {
    const d = e.toLowerCase().split('@')[1] || '';
    return !d.includes('.edu') && !d.includes('.ac.');
  });

  if (category === 'academic') {
    return eduEmail || pool[0];
  }
  return nonEduEmail || pool[0];
}

export function inferCountryFromCard(card: Partial<BusinessCardData>): string {
  const direct = normalizeCountry(card.country || card.translations?.country || '');
  if (direct && STANDARD_COUNTRY_SET.has(direct) && direct !== 'Other') {
    return direct;
  }

  const emails = splitMultiValues(card.email).map((e) => e.toLowerCase());
  const website = (card.website || '').toLowerCase();
  const domainText = [...emails.map((e) => e.split('@')[1] || ''), website].join(' ');
  const fullText = [
    card.company,
    card.translations?.company,
    card.address,
    card.summary,
    card.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const phone = (card.phone || '').replace(/\s+/g, '');

  const companyAndAddress = [card.company, card.translations?.company, card.address]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/aachen|berlin|munich|münchen|frankfurt|germany|deutschland|德國/.test(companyAndAddress)) {
    return 'Germany';
  }
  if (/california|los angeles|new york|washington|texas|san francisco|boston|chicago|united states|u\.s\.a/.test(companyAndAddress)) {
    return 'United States';
  }
  if (/seoul|busan|incheon|daegu|korea|韓國|南韓/.test(companyAndAddress)) {
    return 'South Korea';
  }
  if (/dongguan|beijing|shanghai|guangzhou|shenzhen|東莞|北京|上海|廣州|深圳|中國大陸/.test(companyAndAddress)) {
    return 'China Mainland';
  }
  if (/hong kong|香港/.test(companyAndAddress)) {
    return 'Hong Kong SAR';
  }
  if (
    /taiwan|taipei|yilan|kaohsiung|taichung|tainan|hsinchu|hualien|taoyuan|keelung|台灣|臺灣|台北|臺北|新北|宜蘭|桃園|新竹|台中|臺中|台南|臺南|高雄|花蓮/.test(
      companyAndAddress
    )
  ) {
    return 'Taiwan SAR';
  }

  // Domain TLD matching
  if (/\.(edu|gov|org|com|net)\.tw\b|\.tw\b/.test(domainText)) return 'Taiwan SAR';
  if (/\.(edu|gov|org|com)\.hk\b|\.hk\b/.test(domainText)) return 'Hong Kong SAR';
  if (/\.(edu|gov|org|com)\.mo\b|\.mo\b/.test(domainText)) return 'Macau SAR';
  if (/\.(edu|gov|org|com)\.cn\b|\.cn\b/.test(domainText)) return 'China Mainland';
  if (/\.(ac|co|go|or|re)\.kr\b|\.kr\b/.test(domainText)) return 'South Korea';
  if (/\.(ac|co|go|or|ne)\.jp\b|\.jp\b/.test(domainText)) return 'Japan';
  if (/\.(edu|gov|com|org)\.vn\b|\.vn\b/.test(domainText)) return 'Vietnam';
  if (/\.(edu|gov|com|org)\.my\b|\.my\b/.test(domainText)) return 'Malaysia';
  if (/\.(edu|gov|com|org)\.ph\b|\.ph\b/.test(domainText)) return 'Philippines';
  if (/\.(ac|co|go|or)\.th\b|\.th\b/.test(domainText)) return 'Thailand';
  if (/\.(ac|co|go|or)\.id\b|\.id\b/.test(domainText)) return 'Indonesia';
  if (/\.(edu|gov|com|org)\.sg\b|\.sg\b/.test(domainText)) return 'Singapore';
  if (/\.(ac|ernet|edu|res|gov|co)\.in\b|\.in\b/.test(domainText)) return 'India';
  if (/\.(edu|gov|com|org)\.au\b|\.au\b/.test(domainText)) return 'Australia';
  if (/\.(ac|govt|co|org)\.nz\b|\.nz\b/.test(domainText)) return 'New Zealand';
  if (/\.(ac|gov|co|org)\.uk\b|\.uk\b/.test(domainText)) return 'United Kingdom';
  if (/\.de\b/.test(domainText)) return 'Germany';
  if (/\.fr\b/.test(domainText)) return 'France';
  if (/\.se\b/.test(domainText)) return 'Sweden';
  if (/\.pl\b/.test(domainText)) return 'Poland';
  if (/\.cz\b/.test(domainText)) return 'Czech Republic';
  if (/\.tr\b/.test(domainText)) return 'Turkey';
  if (/\.py\b/.test(domainText)) return 'Paraguay';
  if (/\.ca\b/.test(domainText)) return 'Canada';
  if (/\.edu\b/.test(domainText) && !/\.edu\.[a-z]{2}\b/.test(domainText)) {
    return 'United States';
  }

  if (
    phone.startsWith('+886') ||
    /taiwan|taipei|yilan|kaohsiung|taichung|tainan|hsinchu|hualien|taoyuan|keelung|台灣|臺灣|台北|臺北|新北|宜蘭|桃園|新竹|台中|臺中|台南|臺南|高雄|花蓮/.test(
      fullText
    )
  ) {
    return 'Taiwan SAR';
  }
  if (/tokyo|osaka|kyoto|fukuoka|hokkaido|japan|日本|東京|大阪|京都/.test(fullText)) {
    return 'Japan';
  }

  return direct;
}

function isAcademicOrResearchOrg(card: Partial<BusinessCardData>): boolean {
  const comp = `${card.company || ''} ${card.translations?.company || ''}`.toLowerCase();
  const emails = splitMultiValues(card.email).map((e) => e.toLowerCase());

  if (
    /university|universiti|universidad|universitas|université|universität|college|polytechnic|institute of technology|research institutes?|research cent(er|re)|academy of sciences|academia sinica|hochschule|大學|學院|研究院|研究中心/.test(
      comp
    )
  ) {
    return true;
  }

  return emails.some((e) => /\.(edu|ac)\b/.test(e));
}

function isPublicOrNgoOrg(card: Partial<BusinessCardData>): boolean {
  const comp = `${card.company || ''} ${card.translations?.company || ''}`.toLowerCase();
  const emails = splitMultiValues(card.email).map((e) => e.toLowerCase());

  if (
    /foundation|association|federation|society|ngo|non-profit|nonprofit|ministry|government|embassy|council|bureau|hospital|基金會|協會|學會|公會|聯盟|政府|公所|處|局|署|部|醫院|社福/.test(
      comp
    )
  ) {
    return true;
  }

  return emails.some((e) => /\.(gov|org)\b/.test(e));
}

function hasAcademicRank(card: Partial<BusinessCardData>): boolean {
  const text = [card.prefix, card.title, card.translations?.title, card.summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    /\b(prof\.?|professor|associate professor|assistant professor|lecturer|dean|provost|chancellor|rector|fellow|researcher|scientist|postdoc|scholar|ph\.?d\.?|dr\.?)\b/.test(
      text
    )
  ) {
    return true;
  }

  return /教授|副教授|助理教授|講師|講座|院長|校長|研究員|博士|學者|顧問/.test(text);
}

export type QsAuditIssueType =
  | 'missing_name'
  | 'academic_as_staff'
  | 'admin_staff_as_academic'
  | 'incomplete_non_qs';

export interface QsCategoryAuditResult {
  hasError: boolean;
  currentCategory: BusinessCardData['category'];
  suggestedCategory: BusinessCardData['category'];
  issueType?: QsAuditIssueType;
  reason?: string;
}

export function auditCardQsCategory(card: BusinessCardData): QsCategoryAuditResult {
  const current = card.category || 'other';
  const hasName = Boolean((card.firstName || '').trim() || (card.lastName || '').trim());

  if (!hasName && current !== 'other') {
    return {
      hasError: true,
      currentCategory: current,
      suggestedCategory: 'other',
      issueType: 'missing_name',
      reason: '缺少聯絡人姓名（如通用店家或機構總機名片），建議歸為「一般聯絡人」',
    };
  }

  return {
    hasError: false,
    currentCategory: current,
    suggestedCategory: current,
  };
}

export interface QsReadinessCheck {
  isReady: boolean;
  effectiveEmail: string;
  effectiveCountry: string;
  blockingReasons: string[];
}

export function evaluateQsReadiness(card: BusinessCardData): QsReadinessCheck {
  const blockingReasons: string[] = [];

  const firstName = (card.firstName || '').trim();
  const lastName = (card.lastName || '').trim();
  if (!firstName && !lastName) {
    blockingReasons.push('缺少聯絡人姓名');
  }

  const effectiveEmail = selectBestQsEmail(card.email, card.category);
  if (!effectiveEmail) {
    blockingReasons.push('缺少有效 Email');
  }

  if (!(card.company || '').trim()) {
    blockingReasons.push('缺少公司或機構名稱');
  }

  if (!(card.title || '').trim()) {
    blockingReasons.push('缺少職稱');
  }

  const effectiveCountry = inferCountryFromCard(card);
  if (!effectiveCountry) {
    blockingReasons.push('缺少國家/地區');
  }

  return {
    isReady: blockingReasons.length === 0,
    effectiveEmail,
    effectiveCountry,
    blockingReasons,
  };
}

export interface BoundQsListSummary {
  readyCards: BusinessCardData[];
  academicCards: BusinessCardData[];
  employerCards: BusinessCardData[];
  staffCards: BusinessCardData[];
  excludedDuplicates: BusinessCardData[];
  auditIssues: Array<{ card: BusinessCardData; audit: QsCategoryAuditResult }>;
}

/**
 * 彙整資料完整且已去重之有效聯絡人名單
 */
export function getBoundQsSubmissionList(allCards: BusinessCardData[]): BoundQsListSummary {
  const auditIssues: Array<{ card: BusinessCardData; audit: QsCategoryAuditResult }> = [];
  for (const card of allCards) {
    const audit = auditCardQsCategory(card);
    if (audit.hasError) {
      auditIssues.push({ card, audit });
    }
  }

  const scoreCard = (c: BusinessCardData): number => {
    let s = 0;
    if (c.prefix) s += 1;
    if (c.department) s += 2;
    if (c.subject) s += 2;
    if (c.industry) s += 2;
    if (c.phone) s += 1;
    if (c.country) s += 2;
    if (c.syncStatus === 'firebase') s += 1;
    return s;
  };

  const candidates = allCards
    .map((card) => {
      const check = evaluateQsReadiness(card);
      if (!check.isReady) return null;
      const prepared: BusinessCardData = {
        ...card,
        source: (card.source || '').trim() || DEFAULT_CARD_SOURCE,
        country: check.effectiveCountry,
        email: check.effectiveEmail,
      };
      return { card: prepared, emailKey: check.effectiveEmail.toLowerCase(), score: scoreCard(card) };
    })
    .filter((x): x is { card: BusinessCardData; emailKey: string; score: number } => Boolean(x))
    .sort((a, b) => b.score - a.score || b.card.scannedAt - a.card.scannedAt);

  const seenEmails = new Set<string>();
  const seenPersonOrg = new Set<string>();
  const readyCards: BusinessCardData[] = [];
  const excludedDuplicates: BusinessCardData[] = [];

  for (const item of candidates) {
    const personOrgKey = `${item.card.lastName.trim().toLowerCase()}|${item.card.firstName
      .trim()
      .toLowerCase()}|${item.card.company.trim().toLowerCase()}`;

    if (seenEmails.has(item.emailKey) || seenPersonOrg.has(personOrgKey)) {
      excludedDuplicates.push(item.card);
      continue;
    }

    seenEmails.add(item.emailKey);
    seenPersonOrg.add(personOrgKey);
    readyCards.push(item.card);
  }

  readyCards.sort((a, b) => {
    const na = `${a.lastName} ${a.firstName}`.toLowerCase();
    const nb = `${b.lastName} ${b.firstName}`.toLowerCase();
    return na.localeCompare(nb, 'zh-Hant');
  });

  return {
    readyCards,
    academicCards: readyCards.filter((c) => c.category === 'academic'),
    employerCards: readyCards.filter((c) => c.category === 'employer'),
    staffCards: readyCards.filter((c) => c.category === 'staff'),
    excludedDuplicates,
    auditIssues,
  };
}

export function stripQsAuditNotes(text?: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('[QS'))
    .join('\n')
    .trim();
}

export function determineBestQsCategoryForMergedCard(
  card: BusinessCardData
): BusinessCardData['category'] {
  const hasName = Boolean((card.firstName || '').trim() || (card.lastName || '').trim());
  if (!hasName) return 'other';

  if (isAcademicOrResearchOrg(card)) {
    return hasAcademicRank(card) ? 'academic' : 'staff';
  }
  if (isPublicOrNgoOrg(card)) {
    return 'staff';
  }
  if ((card.company || '').trim()) {
    return 'employer';
  }
  return card.category || 'other';
}

export function getCategoryDisplayLabel(category?: BusinessCardData['category']): string {
  const key = category || 'other';
  return CATEGORY_LABELS[key]?.short || '一般聯絡人';
}
