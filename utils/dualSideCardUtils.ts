import {
  BusinessCardData,
  BackSideExtractionResult,
  BackSideExtractedFields,
} from '../types';
import { normalizeCountry } from './countries';
import {
  DEFAULT_CARD_SOURCE,
  inferCountryFromCard,
  determineBestQsCategoryForMergedCard,
  splitMultiValues,
} from './qsValidation';

const CJK_REGEX = /[\u3400-\u9FBF\uF900-\uFAFF]/;
const LATIN_WORD_REGEX = /[A-Za-z]{2,}/;

export function containsCjk(value?: string | null): boolean {
  if (!value) return false;
  return CJK_REGEX.test(value);
}

export function isEnglishDominant(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return LATIN_WORD_REGEX.test(trimmed) && !CJK_REGEX.test(trimmed);
}

function normalizeTokenKey(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;]+$/g, '');
}

function splitSlashParts(val?: string | null): string[] {
  if (!val) return [];
  return String(val)
    .split(/\s*\/\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function deduplicateSlashJoin(values: Array<string | undefined | null>): string {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    for (const part of splitSlashParts(raw)) {
      const key = normalizeTokenKey(part);
      if (!key) continue;
      // Skip if exact match or already contained in an existing longer segment
      const alreadyCovered = Array.from(seen).some(
        (existing) => existing === key || (key.length >= 4 && existing.includes(key))
      );
      if (!alreadyCovered) {
        seen.add(key);
        result.push(part);
      }
    }
  }

  return result.join(' / ');
}

/**
 * 雙語欄位自動升降：英文優先放入 primary，中文自動保留至 translation
 */
export function resolveBilingualPair(
  frontPrimary?: string,
  frontTrans?: string,
  backPrimary?: string,
  backTrans?: string,
  allowSlashCombine = false
): { primary: string; translation: string; promotedEnglish: boolean } {
  const candidates = [frontPrimary, frontTrans, backPrimary, backTrans]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return { primary: '', translation: '', promotedEnglish: false };
  }

  const englishItems: string[] = [];
  const cjkItems: string[] = [];
  const mixedOrOtherItems: string[] = [];

  for (const item of candidates) {
    for (const part of splitSlashParts(item)) {
      if (isEnglishDominant(part)) {
        englishItems.push(part);
      } else if (containsCjk(part)) {
        cjkItems.push(part);
      } else {
        mixedOrOtherItems.push(part);
      }
    }
  }

  const frontWasCjk = containsCjk(frontPrimary) && !isEnglishDominant(frontPrimary);

  if (allowSlashCombine) {
    const joinedEng = deduplicateSlashJoin([...englishItems, ...mixedOrOtherItems]);
    const joinedCjk = deduplicateSlashJoin(cjkItems);
    if (joinedEng) {
      return {
        primary: joinedEng,
        translation: joinedCjk,
        promotedEnglish: frontWasCjk,
      };
    }
    return {
      primary: joinedCjk,
      translation: '',
      promotedEnglish: false,
    };
  }

  // Non-slash single-entity mode (e.g., bilingual mirror of same company or same title)
  const bestEng = englishItems[0] || mixedOrOtherItems[0] || '';
  const bestCjk = deduplicateSlashJoin(cjkItems);

  if (bestEng) {
    return {
      primary: bestEng,
      translation: bestCjk,
      promotedEnglish: frontWasCjk,
    };
  }

  return {
    primary: cjkItems[0] || '',
    translation: cjkItems.slice(1).join(' / '),
    promotedEnglish: false,
  };
}

function resolvePersonNamePair(
  frontFirst?: string,
  frontLast?: string,
  frontPrefix?: string,
  backFirst?: string,
  backLast?: string,
  backPrefix?: string
): {
  firstName: string;
  lastName: string;
  prefix: string;
  cjkNameNote?: string;
  promotedEnglishName: boolean;
} {
  const fFull = `${frontLast || ''}${frontFirst || ''}`.trim();
  const bFull = `${backLast || ''} ${backFirst || ''}`.trim();

  const fHasCjk = containsCjk(fFull);
  const bIsEng = isEnglishDominant(bFull) && Boolean((backFirst || '').trim() || (backLast || '').trim());
  const fIsEng = isEnglishDominant(fFull) && Boolean((frontFirst || '').trim() || (frontLast || '').trim());
  const bHasCjk = containsCjk(bFull);

  let prefix = (frontPrefix || '').trim();
  if ((!prefix || containsCjk(prefix)) && backPrefix && isEnglishDominant(backPrefix)) {
    prefix = backPrefix.trim();
  } else if (!prefix && backPrefix) {
    prefix = backPrefix.trim();
  }

  // Front is Chinese name, Back has English name -> Promote English to primary!
  if (fHasCjk && bIsEng) {
    return {
      firstName: (backFirst || '').trim(),
      lastName: (backLast || '').trim(),
      prefix,
      cjkNameNote: fFull,
      promotedEnglishName: true,
    };
  }

  // Front is already English, Back has Chinese name -> Keep English in primary
  if (fIsEng) {
    return {
      firstName: (frontFirst || '').trim(),
      lastName: (frontLast || '').trim(),
      prefix,
      cjkNameNote: bHasCjk ? `${backLast || ''}${backFirst || ''}`.trim() : undefined,
      promotedEnglishName: false,
    };
  }

  return {
    firstName: (frontFirst || backFirst || '').trim(),
    lastName: (frontLast || backLast || '').trim(),
    prefix,
    promotedEnglishName: false,
  };
}

function mergeEmails(frontEmail?: string, backEmail?: string): string {
  const all = [...splitMultiValues(frontEmail), ...splitMultiValues(backEmail)];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const e of all) {
    const clean = e.trim();
    const low = clean.toLowerCase();
    if (clean && !seen.has(low)) {
      seen.add(low);
      unique.push(clean);
    }
  }
  return unique.join(' / ');
}

function mergePhones(frontPhone?: string, backPhone?: string): string {
  const all = [...splitMultiValues(frontPhone), ...splitMultiValues(backPhone)];
  const seenDigits = new Set<string>();
  const unique: string[] = [];
  for (const p of all) {
    const clean = p.trim();
    const digits = clean.replace(/\D/g, '');
    if (!clean) continue;
    const key = digits.length >= 6 ? digits.slice(-8) : clean.toLowerCase();
    if (!seenDigits.has(key)) {
      seenDigits.add(key);
      unique.push(clean);
    }
  }
  return unique.join(' / ');
}

/**
 * 判斷正反面是否存在「機構不同」或「疑似不同聯絡人」衝突，需交由使用者於對照彈窗確認
 */
export function detectDualSideConflict(
  front: BusinessCardData,
  extraction: BackSideExtractionResult
): {
  hasConflict: boolean;
  isDifferentPerson: boolean;
  isDifferentOrg: boolean;
  conflictReason: string;
} {
  const back = extraction.backOnly || {};

  const frontHasPerson = Boolean((front.firstName || '').trim() || (front.lastName || '').trim());
  const backHasPerson = Boolean((back.firstName || '').trim() || (back.lastName || '').trim());

  const frontHasOrg = Boolean((front.company || '').trim());
  const backHasOrg = Boolean((back.company || '').trim());

  // Deterministic same-language check to avoid false-positive conflicts on bilingual mirrors
  const bothSameScriptOrgs =
    frontHasOrg &&
    backHasOrg &&
    ((isEnglishDominant(front.company) && isEnglishDominant(back.company)) ||
      (containsCjk(front.company) && containsCjk(back.company)));

  let sameScriptOrgMismatch = false;
  if (bothSameScriptOrgs) {
    const fNorm = normalizeTokenKey(front.company);
    const bNorm = normalizeTokenKey(back.company || '');
    if (fNorm && bNorm && !fNorm.includes(bNorm) && !bNorm.includes(fNorm)) {
      sameScriptOrgMismatch = true;
    }
  }

  const bothSameScriptNames =
    frontHasPerson &&
    backHasPerson &&
    ((isEnglishDominant(`${front.firstName} ${front.lastName}`) &&
      isEnglishDominant(`${back.firstName || ''} ${back.lastName || ''}`)) ||
      (containsCjk(`${front.lastName}${front.firstName}`) &&
        containsCjk(`${back.lastName || ''}${back.firstName || ''}`)));

  let sameScriptPersonMismatch = false;
  if (bothSameScriptNames) {
    const fLast = normalizeTokenKey(front.lastName || '');
    const bLast = normalizeTokenKey(back.lastName || '');
    if (fLast && bLast && fLast !== bLast && !fLast.includes(bLast) && !bLast.includes(fLast)) {
      sameScriptPersonMismatch = true;
    }
  }

  const isDifferentPerson = Boolean(
    (frontHasPerson && backHasPerson && extraction.hasDifferentPerson) || sameScriptPersonMismatch
  );

  const isDifferentOrg = Boolean(
    (frontHasOrg && backHasOrg && extraction.hasDifferentOrg) || sameScriptOrgMismatch
  );

  const hasConflict =
    extraction.relationType === 'different_entity' || isDifferentPerson || isDifferentOrg;

  if (!hasConflict) {
    return {
      hasConflict: false,
      isDifferentPerson: false,
      isDifferentOrg: false,
      conflictReason: '',
    };
  }

  const defaultReason = isDifferentPerson
    ? '偵測到正反面的聯絡人姓名不一致，可能是兩張不同人的名片誤合為正反面。'
    : '偵測到正反面印有不同的公司／學校機構名稱，可能是跨機構兼任身分或兩張不同名片。';

  return {
    hasConflict: true,
    isDifferentPerson,
    isDifferentOrg,
    conflictReason: (extraction.conflictSummary || '').trim() || defaultReason,
  };
}

/**
 * 依據指定策略合併正反面名片欄位：
 * - 'auto': 雙語英文自動升主欄、中文存對照欄；前後不同職稱以 `/` 併列，並自動重算 QS 分類
 * - 'merge_concurrent': 同人跨機構兼任，將機構、部門與職稱皆以 `/` 併列，並重算 QS 分類
 * - 'keep_image_only': 維持正面所有主要身分機構職稱，僅保留雙面影像並補齊空白聯絡方式
 */
export function applyDualSideMerge(
  frontCard: BusinessCardData,
  extraction: BackSideExtractionResult,
  strategy: 'auto' | 'merge_concurrent' | 'keep_image_only' = 'auto'
): { updatedCard: BusinessCardData; highlights: string[] } {
  const back: BackSideExtractedFields = extraction.backOnly || {};
  const suggested: BackSideExtractedFields = extraction.mergedSuggestion || {};
  const highlights: string[] = [];

  if (strategy === 'keep_image_only') {
    const kept: BusinessCardData = {
      ...frontCard,
      email: frontCard.email || back.email || '',
      phone: frontCard.phone || back.phone || '',
      website: frontCard.website || back.website || '',
    };
    highlights.push('已保留正面機構與職稱，僅保存反面影像與補充空白聯絡方式');
    return { updatedCard: kept, highlights };
  }

  const next: BusinessCardData = {
    ...frontCard,
    translations: { ...(frontCard.translations || {}) },
  };

  // 1. Name & Prefix (English promoted to primary)
  const nameRes = resolvePersonNamePair(
    frontCard.firstName,
    frontCard.lastName,
    frontCard.prefix,
    back.firstName || suggested.firstName,
    back.lastName || suggested.lastName,
    back.prefix || suggested.prefix
  );
  next.firstName = nameRes.firstName;
  next.lastName = nameRes.lastName;
  next.prefix = nameRes.prefix;
  if (nameRes.promotedEnglishName) {
    highlights.push('已將英文姓名升為主欄位');
  }

  // 2. Title (Slash-merge if distinct roles exist; English promoted, Chinese kept in translations.title)
  const shouldSlashTitles =
    Boolean(extraction.hasDifferentTitle) ||
    extraction.relationType === 'dual_role_same_person' ||
    strategy === 'merge_concurrent' ||
    (isEnglishDominant(frontCard.title) &&
      isEnglishDominant(back.title) &&
      normalizeTokenKey(frontCard.title) !== normalizeTokenKey(back.title || '')) ||
    (containsCjk(frontCard.title) &&
      containsCjk(back.title) &&
      normalizeTokenKey(frontCard.title) !== normalizeTokenKey(back.title || ''));

  const titleRes = resolveBilingualPair(
    frontCard.title,
    frontCard.translations?.title,
    back.title,
    back.translations?.title,
    shouldSlashTitles
  );
  if (titleRes.primary) {
    const prevTitle = next.title;
    next.title = titleRes.primary;
    if (titleRes.translation) {
      next.translations = { ...next.translations, title: titleRes.translation };
    }
    if (shouldSlashTitles && next.title.includes(' / ') && next.title !== prevTitle) {
      highlights.push(`已併列雙職稱：${next.title}`);
    } else if (titleRes.promotedEnglish) {
      highlights.push('英文職稱已升為主欄，中文保留至對照欄');
    }
  }

  // 3. Company / Institution (Slash-merge if strategy === 'merge_concurrent', otherwise bilingual promote)
  const allowOrgSlash = strategy === 'merge_concurrent';
  const compRes = resolveBilingualPair(
    frontCard.company,
    frontCard.translations?.company,
    back.company,
    back.translations?.company,
    allowOrgSlash
  );
  if (compRes.primary) {
    const prevComp = next.company;
    next.company = compRes.primary;
    if (compRes.translation) {
      next.translations = { ...next.translations, company: compRes.translation };
    }
    if (allowOrgSlash && next.company.includes(' / ') && next.company !== prevComp) {
      highlights.push(`已併列兼任機構：${next.company}`);
    } else if (compRes.promotedEnglish) {
      highlights.push('英文機構名稱已升為主欄，中文保留至對照欄');
    }
  }

  // 4. Department, Industry, Subject
  const allowDeptSlash = shouldSlashTitles;
  const deptRes = resolveBilingualPair(
    frontCard.department,
    frontCard.translations?.department,
    back.department,
    back.translations?.department,
    allowDeptSlash
  );
  if (deptRes.primary) {
    next.department = deptRes.primary;
    if (deptRes.translation) {
      next.translations = { ...next.translations, department: deptRes.translation };
    }
  }

  const indRes = resolveBilingualPair(
    frontCard.industry,
    frontCard.translations?.industry,
    back.industry,
    back.translations?.industry,
    false
  );
  if (indRes.primary) {
    next.industry = indRes.primary;
    if (indRes.translation) {
      next.translations = { ...next.translations, industry: indRes.translation };
    }
  }

  const subjRes = resolveBilingualPair(
    frontCard.subject,
    frontCard.translations?.subject,
    back.subject,
    back.translations?.subject,
    true
  );
  if (subjRes.primary) {
    next.subject = subjRes.primary;
    if (subjRes.translation) {
      next.translations = { ...next.translations, subject: subjRes.translation };
    }
  }

  // 5. Address & Website (Prefer English address if front is Chinese, or append distinct branch address)
  if (back.address && back.address.trim()) {
    const bAddr = back.address.trim();
    if (!next.address) {
      next.address = bAddr;
    } else if (containsCjk(next.address) && isEnglishDominant(bAddr)) {
      next.address = bAddr;
    } else if (
      strategy === 'merge_concurrent' &&
      normalizeTokenKey(next.address) !== normalizeTokenKey(bAddr)
    ) {
      next.address = deduplicateSlashJoin([next.address, bAddr]);
    }
  }

  if (back.website && back.website.trim()) {
    next.website = deduplicateSlashJoin([next.website, back.website]);
  }

  // 6. Emails, Phones, Fax
  next.email = mergeEmails(next.email, back.email);
  next.phone = mergePhones(next.phone, back.phone);
  next.fax = mergePhones(next.fax, back.fax);

  // 7. Supplementary Back Notes (only real business items/services, never category notes)
  if (back.notes && back.notes.trim()) {
    const cleanNote = back.notes.trim();
    if (!next.notes) {
      next.notes = cleanNote;
    } else if (!next.notes.includes(cleanNote)) {
      next.notes = `${next.notes}\n${cleanNote}`;
    }
  }

  // 8. Country Normalization & Inference
  const rawCountry = back.country ? normalizeCountry(back.country) : '';
  if (!next.country && rawCountry) {
    next.country = rawCountry;
  }
  const inferredCtry = inferCountryFromCard(next);
  if (inferredCtry && (!next.country || next.country !== inferredCtry)) {
    next.country = inferredCtry;
  }

  // 9. Recalculate contact category directly without writing any notes
  const prevCat = next.category;
  const bestCat = determineBestQsCategoryForMergedCard(next);
  if (bestCat !== prevCat) {
    next.category = bestCat;
    const catLabelMap: Record<BusinessCardData['category'], string> = {
      academic: '學研專家',
      employer: '企業夥伴',
      staff: '機關社團',
      other: '一般聯絡人',
    };
    highlights.push(`聯絡人分類自動對應為「${catLabelMap[bestCat]}」`);
  }

  return { updatedCard: next, highlights };
}

/**
 * 將雙面名片的反面獨立拆分為第二張新名片，並清除原正面名片的反面影像連結
 */
export function splitDualSideIntoTwoCards(
  frontCard: BusinessCardData,
  extraction: BackSideExtractionResult
): {
  cleanedFrontCard: BusinessCardData;
  newBackCard: BusinessCardData;
} {
  const back = extraction.backOnly || {};

  const cleanedFrontCard: BusinessCardData = {
    ...frontCard,
    backImageUrl: undefined,
    backImageId: undefined,
    backRotation: 0,
  };

  const titlePair = resolveBilingualPair(
    back.title,
    back.translations?.title,
    undefined,
    undefined,
    true
  );
  const compPair = resolveBilingualPair(
    back.company,
    back.translations?.company,
    undefined,
    undefined,
    false
  );
  const deptPair = resolveBilingualPair(
    back.department,
    back.translations?.department,
    undefined,
    undefined,
    true
  );
  const indPair = resolveBilingualPair(
    back.industry,
    back.translations?.industry,
    undefined,
    undefined,
    false
  );
  const subjPair = resolveBilingualPair(
    back.subject,
    back.translations?.subject,
    undefined,
    undefined,
    true
  );

  const backImageUrl = frontCard.backImageUrl || '';
  const draftSecond: BusinessCardData = {
    id: crypto.randomUUID(),
    prefix: (back.prefix || '').trim(),
    firstName: (back.firstName || '').trim(),
    lastName: (back.lastName || '').trim(),
    title: titlePair.primary || (back.title || '').trim(),
    company: compPair.primary || (back.company || '').trim(),
    department: deptPair.primary || (back.department || '').trim(),
    industry: indPair.primary || (back.industry || '').trim(),
    country: back.country ? normalizeCountry(back.country) : '',
    email: (back.email || '').trim(),
    phone: (back.phone || '').trim(),
    fax: (back.fax || '').trim(),
    subject: subjPair.primary || (back.subject || '').trim(),
    source: frontCard.source || DEFAULT_CARD_SOURCE,
    website: (back.website || '').trim(),
    address: (back.address || '').trim(),
    notes: (back.notes || '').trim(),
    tags: frontCard.tags ? [...frontCard.tags] : [],
    category: 'other',
    reasoning: '',
    summary: '',
    scannedAt: Date.now(),
    syncStatus: backImageUrl.startsWith('http') ? 'firebase' : 'local',
    imageUrl: backImageUrl,
    imageId: frontCard.backImageId,
    rotation: frontCard.backRotation || 0,
    translations: {
      title: titlePair.translation || back.translations?.title || '',
      company: compPair.translation || back.translations?.company || '',
      department: deptPair.translation || back.translations?.department || '',
      industry: indPair.translation || back.translations?.industry || '',
      subject: subjPair.translation || back.translations?.subject || '',
      country: back.translations?.country ? normalizeCountry(back.translations.country) : '',
    },
  };

  const inferredCtry = inferCountryFromCard(draftSecond);
  if (inferredCtry && !draftSecond.country) {
    draftSecond.country = inferredCtry;
  }

  draftSecond.category = determineBestQsCategoryForMergedCard(draftSecond);

  return {
    cleanedFrontCard,
    newBackCard: draftSecond,
  };
}
