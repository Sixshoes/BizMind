import { BusinessCardData } from '../types';

export interface DuplicateGroup {
  id: string;
  reason: string;
  primaryCardId: string;
  cards: BusinessCardData[];
}

export interface DeduplicateAnalysis {
  groups: DuplicateGroup[];
  totalDuplicateCount: number; // Redundant cards that will be deleted
  duplicateCardIds: Set<string>;
  recommendedDeletions: Set<string>;
  recommendedKeep: Map<string, string>; // groupId -> primaryCardId
}

/**
 * Normalizes text for comparison (lowercase, trimmed, strip extraneous whitespace/punctuation)
 */
const cleanStr = (val?: string): string => {
  if (!val) return '';
  return String(val)
    .toLowerCase()
    .trim()
    .replace(/[\s\-_.,/\\()[\]{}'"“”‘’]/g, '');
};

/**
 * Normalizes phone numbers (digits only, removing leading international prefixes if matching)
 */
const cleanPhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // If digits are at least 7, return normalized digits
  if (digits.length >= 7) {
    // Strip leading 886 for Taiwan numbers if followed by 9...
    if (digits.startsWith('8869')) return '0' + digits.slice(3);
    return digits;
  }
  return digits;
};

/**
 * Computes a data completeness & quality score for a card
 */
export const calculateCardQualityScore = (card: BusinessCardData): number => {
  let score = 0;
  if (card.imageUrl && card.imageUrl.trim() !== '') score += 15;
  if (card.email && card.email.trim() !== '') score += 10;
  if (card.phone && card.phone.trim() !== '') score += 8;
  if (card.company && card.company.trim() !== '') score += 6;
  if (card.title && card.title.trim() !== '') score += 5;
  if (card.firstName || card.lastName) score += 5;
  if (card.country || card.translations?.country) score += 4;
  if (card.summary && card.summary.trim() !== '') score += 4;
  if (card.department && card.department.trim() !== '') score += 3;
  if (card.address && card.address.trim() !== '') score += 3;
  if (card.website && card.website.trim() !== '') score += 2;
  if (card.syncStatus === 'notion') score += 5;
  if (card.category && card.category !== 'other') score += 3;
  if (card.notes && card.notes.trim() !== '') score += 1;
  return score;
};

/**
 * Checks whether two cards are considered duplicates
 * Dual Strategy:
 * 1. When both cards have Email: Email must match, Name must match, plus >= 1 other field (Total >= 3).
 * 2. When either or both cards lack Email: Name must match, plus either:
 *    - Same card image/asset
 *    - Same Company AND same Title
 *    - Same Company AND same Phone
 *    - Same Phone AND same Title
 *    - Or matches Name + Company + Country + >= 1 other field (Total >= 3 fields).
 */
export const areCardsDuplicate = (
  a: BusinessCardData, 
  b: BusinessCardData
): { isDuplicate: boolean; reason?: string; matchCount: number; matchedFields: string[] } => {
  if (a.id === b.id) return { isDuplicate: false, matchCount: 0, matchedFields: [] };

  const matchedFields: string[] = [];

  // 比對 Email
  const emailA = cleanStr(a.email);
  const emailB = cleanStr(b.email);
  const hasEmailA = emailA.length >= 4;
  const hasEmailB = emailB.length >= 4;

  // 1. 如果雙方皆有 Email，但 Email 不相同：極可能是不同人（例如不同機構或不同帳號），直接排除
  if (hasEmailA && hasEmailB && emailA !== emailB) {
    return { isDuplicate: false, matchCount: 0, matchedFields: [] };
  }

  // 2. 比對 姓名 (LastName + FirstName 必須存在且完全相同)
  const nameA = cleanStr(`${a.lastName || ''}${a.firstName || ''}`);
  const nameB = cleanStr(`${b.lastName || ''}${b.firstName || ''}`);
  if (!nameA || !nameB || nameA !== nameB || nameA.length < 1) {
    return { isDuplicate: false, matchCount: 0, matchedFields: [] };
  }
  matchedFields.push(`姓名 (${(a.lastName || '') + (a.firstName || '')})`);

  // 3. Email 相同判定
  const hasMatchedEmail = hasEmailA && hasEmailB && emailA === emailB;
  if (hasMatchedEmail) {
    matchedFields.push(`Email (${a.email})`);
  }

  // 4. 比對其他欄位
  // 4.1 公司 (Company)
  const compA = cleanStr(a.company);
  const compB = cleanStr(b.company);
  const transCompA = cleanStr(a.translations?.company);
  const transCompB = cleanStr(b.translations?.company);
  let compMatched = false;
  if (
    (compA && compB && compA === compB && compA.length >= 2) ||
    (transCompA && transCompB && transCompA === transCompB && transCompA.length >= 2) ||
    (compA && transCompB && compA === transCompB && compA.length >= 2) ||
    (transCompA && compB && transCompA === compB && transCompA.length >= 2)
  ) {
    compMatched = true;
    matchedFields.push(`公司 (${a.company || a.translations?.company || b.company})`);
  }

  // 4.2 電話 (Phone, >= 7 位數)
  const phoneA = cleanPhone(a.phone);
  const phoneB = cleanPhone(b.phone);
  let phoneMatched = false;
  if (phoneA && phoneB && phoneA.length >= 7 && phoneA === phoneB) {
    phoneMatched = true;
    matchedFields.push(`電話 (${a.phone})`);
  }

  // 4.3 職稱 (Title)
  const titleA = cleanStr(a.title);
  const titleB = cleanStr(b.title);
  const transTitleA = cleanStr(a.translations?.title);
  const transTitleB = cleanStr(b.translations?.title);
  let titleMatched = false;
  if (
    (titleA && titleB && titleA === titleB && titleA.length >= 2) ||
    (transTitleA && transTitleB && transTitleA === transTitleB && transTitleA.length >= 2)
  ) {
    titleMatched = true;
    matchedFields.push(`職稱 (${a.title || a.translations?.title || b.title})`);
  }

  // 4.4 圖片完全相同 (Image URL 或 Image ID)
  const imgA = a.imageUrl?.trim();
  const imgB = b.imageUrl?.trim();
  const imgIdA = a.imageId?.trim();
  const imgIdB = b.imageId?.trim();
  let imgMatched = false;
  if (
    (imgA && imgB && imgA === imgB && imgA.length >= 10) ||
    (imgIdA && imgIdB && imgIdA === imgIdB && imgIdA.length >= 3)
  ) {
    imgMatched = true;
    matchedFields.push(`名片圖片完全相同`);
  }

  // 4.5 國家 (Country)
  const ctryA = cleanStr(a.country || a.translations?.country);
  const ctryB = cleanStr(b.country || b.translations?.country);
  let ctryMatched = false;
  if (ctryA && ctryB && ctryA === ctryB && ctryA.length >= 2) {
    ctryMatched = true;
    matchedFields.push(`國家 (${a.country || a.translations?.country})`);
  }

  // 4.6 部門 (Department)
  const deptA = cleanStr(a.department);
  const deptB = cleanStr(b.department);
  const transDeptA = cleanStr(a.translations?.department);
  const transDeptB = cleanStr(b.translations?.department);
  if (
    (deptA && deptB && deptA === deptB && deptA.length >= 2) ||
    (transDeptA && transDeptB && transDeptA === transDeptB && transDeptA.length >= 2)
  ) {
    matchedFields.push(`部門 (${a.department || b.department})`);
  }

  // 4.7 網站 (Website)
  const webA = cleanStr(a.website);
  const webB = cleanStr(b.website);
  if (webA && webB && webA === webB && webA.length >= 5) {
    matchedFields.push(`網站 (${a.website})`);
  }

  // 4.8 地址 (Address)
  const addrA = cleanStr(a.address);
  const addrB = cleanStr(b.address);
  if (addrA && addrB && addrA === addrB && addrA.length >= 5) {
    matchedFields.push(`地址`);
  }

  // --- 判斷依據 ---
  // 情況 1: 雙方皆有 Email 且 Email 相同 (姓名 + Email + 至少 1 項其他欄位，總計 >= 3 項)
  if (hasMatchedEmail && matchedFields.length >= 3) {
    return {
      isDuplicate: true,
      reason: `符合 Email、姓名及其他欄位 (${matchedFields.length} 項)：${matchedFields.join('、')}`,
      matchCount: matchedFields.length,
      matchedFields
    };
  }

  // 情況 2: 雙方沒有 Email 或其中一方無 Email (例如 Alok Arvind 情況)
  // 姓名相同且符合以下高可靠度條件之一：
  // 2a. 名片圖片相同 + 至少一項核心欄位 (公司或職稱或電話)
  // 2b. 同公司 + 同職稱
  // 2c. 同公司 + 同電話
  // 2d. 同電話 + 同職稱
  // 2e. 符合姓名、公司、國家及其他欄位累計 >= 3 項
  if (!hasMatchedEmail) {
    const isStrongDuplicate =
      (imgMatched && (compMatched || titleMatched || phoneMatched)) ||
      (compMatched && titleMatched) ||
      (compMatched && phoneMatched) ||
      (phoneMatched && titleMatched) ||
      (compMatched && ctryMatched && matchedFields.length >= 3);

    if (isStrongDuplicate) {
      return {
        isDuplicate: true,
        reason: `無 Email 比對，但符合姓名及關鍵欄位 (${matchedFields.length} 項)：${matchedFields.join('、')}`,
        matchCount: matchedFields.length,
        matchedFields
      };
    }
  }

  return { isDuplicate: false, matchCount: matchedFields.length, matchedFields };
};

/**
 * Analyzes and clusters cards into duplicate groups using candidate indexing + disjoint-set
 */
export const analyzeDuplicates = (cards: BusinessCardData[]): DeduplicateAnalysis => {
  const n = cards.length;
  if (n <= 1) {
    return {
      groups: [],
      totalDuplicateCount: 0,
      duplicateCardIds: new Set(),
      recommendedDeletions: new Set(),
      recommendedKeep: new Map(),
    };
  }

  // Disjoint set union (DSU)
  const parent = Array.from({ length: n }, (_, i) => i);
  const reasons = new Map<string, string>();

  const find = (i: number): number => {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (i: number, j: number, reason: string) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
      const key = `${Math.min(rootI, rootJ)}_${Math.max(rootI, rootJ)}`;
      reasons.set(key, reason);
    }
  };

  // 多候選桶 (Candidate Buckets)，兼顧效能與無 Email 名片捕捉
  const candidatePairs = new Set<string>();
  const addCandidate = (i: number, j: number) => {
    if (i === j) return;
    const key = i < j ? `${i}_${j}` : `${j}_${i}`;
    candidatePairs.add(key);
  };

  const emailNameBuckets = new Map<string, number[]>();
  const nameCompBuckets = new Map<string, number[]>();
  const namePhoneBuckets = new Map<string, number[]>();
  const imageBuckets = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const card = cards[i];
    const email = cleanStr(card.email);
    const name = cleanStr(`${card.lastName || ''}${card.firstName || ''}`);
    const comp = cleanStr(card.company);
    const phone = cleanPhone(card.phone);
    const img = card.imageUrl?.trim();

    if (email && email.length >= 4 && name && name.length >= 1) {
      const k = `${email}__${name}`;
      if (!emailNameBuckets.has(k)) emailNameBuckets.set(k, []);
      emailNameBuckets.get(k)!.push(i);
    }

    if (name && name.length >= 1 && comp && comp.length >= 2) {
      const k = `${name}__${comp}`;
      if (!nameCompBuckets.has(k)) nameCompBuckets.set(k, []);
      nameCompBuckets.get(k)!.push(i);
    }

    if (name && name.length >= 1 && phone && phone.length >= 7) {
      const k = `${name}__${phone}`;
      if (!namePhoneBuckets.has(k)) namePhoneBuckets.set(k, []);
      namePhoneBuckets.get(k)!.push(i);
    }

    if (img && img.length >= 15) {
      if (!imageBuckets.has(img)) imageBuckets.set(img, []);
      imageBuckets.get(img)!.push(i);
    }
  }

  const collectBucketPairs = (bucketMap: Map<string, number[]>) => {
    bucketMap.forEach((indices) => {
      if (indices.length > 1) {
        for (let i = 0; i < indices.length; i++) {
          for (let j = i + 1; j < indices.length; j++) {
            addCandidate(indices[i], indices[j]);
          }
        }
      }
    });
  };

  collectBucketPairs(emailNameBuckets);
  collectBucketPairs(nameCompBuckets);
  collectBucketPairs(namePhoneBuckets);
  collectBucketPairs(imageBuckets);

  // Evaluate candidate pairs
  candidatePairs.forEach((pairKey) => {
    const [iStr, jStr] = pairKey.split('_');
    const idxA = parseInt(iStr, 10);
    const idxB = parseInt(jStr, 10);
    const match = areCardsDuplicate(cards[idxA], cards[idxB]);
    if (match.isDuplicate) {
      union(idxA, idxB, match.reason || `符合 ${match.matchCount} 欄相同資料`);
    }
  });

  // Group by DSU root
  const groupMap = new Map<number, BusinessCardData[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(cards[i]);
  }

  const groups: DuplicateGroup[] = [];
  const duplicateCardIds = new Set<string>();
  const recommendedDeletions = new Set<string>();
  const recommendedKeep = new Map<string, string>();
  let totalDuplicateCount = 0;

  groupMap.forEach((groupCards, rootIdx) => {
    if (groupCards.length > 1) {
      // Find the primary card with the highest quality score (tie-break with latest scannedAt)
      let bestCard = groupCards[0];
      let bestScore = calculateCardQualityScore(bestCard);

      for (let k = 1; k < groupCards.length; k++) {
        const current = groupCards[k];
        const score = calculateCardQualityScore(current);
        if (score > bestScore || (score === bestScore && (current.scannedAt || 0) > (bestCard.scannedAt || 0))) {
          bestCard = current;
          bestScore = score;
        }
      }

      const groupId = `dup_group_${rootIdx}_${bestCard.id}`;
      const reason = groupCards.length > 2 
        ? `偵測到 ${groupCards.length} 筆相同聯絡人資料`
        : (areCardsDuplicate(groupCards[0], groupCards[1]).reason || '相同名片資料');

      groups.push({
        id: groupId,
        reason,
        primaryCardId: bestCard.id,
        cards: groupCards,
      });

      recommendedKeep.set(groupId, bestCard.id);

      groupCards.forEach(c => {
        duplicateCardIds.add(c.id);
        if (c.id !== bestCard.id) {
          recommendedDeletions.add(c.id);
          totalDuplicateCount++;
        }
      });
    }
  });

  return {
    groups,
    totalDuplicateCount,
    duplicateCardIds,
    recommendedDeletions,
    recommendedKeep,
  };
};

/**
 * Merges data from redundant duplicate cards into the primary card so no important information is lost.
 */
export const mergeDuplicateCards = (
  primary: BusinessCardData,
  redundants: BusinessCardData[]
): BusinessCardData => {
  const merged: BusinessCardData = { ...primary };

  // Accumulate physical cards count
  let count = merged.physicalCount || 1;

  for (const dup of redundants) {
    count += dup.physicalCount || 1;

    // Fill missing basic fields
    if (!merged.firstName && dup.firstName) merged.firstName = dup.firstName;
    if (!merged.lastName && dup.lastName) merged.lastName = dup.lastName;
    if (!merged.company && dup.company) merged.company = dup.company;
    if (!merged.title && dup.title) merged.title = dup.title;
    if (!merged.email && dup.email) merged.email = dup.email;
    if (!merged.phone && dup.phone) merged.phone = dup.phone;
    if (!merged.fax && dup.fax) merged.fax = dup.fax;
    if (!merged.website && dup.website) merged.website = dup.website;
    if (!merged.address && dup.address) merged.address = dup.address;
    if (!merged.department && dup.department) merged.department = dup.department;
    if (!merged.industry && dup.industry) merged.industry = dup.industry;
    if (!merged.country && dup.country) merged.country = dup.country;
    if (!merged.subject && dup.subject) merged.subject = dup.subject;
    if (!merged.summary && dup.summary) merged.summary = dup.summary;
    if (!merged.reasoning && dup.reasoning) merged.reasoning = dup.reasoning;
    if (!merged.imageUrl && dup.imageUrl) {
      merged.imageUrl = dup.imageUrl;
      merged.imageId = dup.imageId;
    }

    // Merge notes if distinct
    if (dup.notes && dup.notes.trim() !== '') {
      if (!merged.notes || merged.notes.trim() === '') {
        merged.notes = dup.notes;
      } else if (!merged.notes.includes(dup.notes)) {
        merged.notes = `${merged.notes}\n${dup.notes}`;
      }
    }

    // Prefer QS classification over 'other'
    if (merged.category === 'other' && dup.category && dup.category !== 'other') {
      merged.category = dup.category;
      if (dup.reasoning) merged.reasoning = dup.reasoning;
    }

    // Merge translations if missing
    if (dup.translations) {
      merged.translations = {
        title: merged.translations?.title || dup.translations.title,
        company: merged.translations?.company || dup.translations.company,
        department: merged.translations?.department || dup.translations.department,
        industry: merged.translations?.industry || dup.translations.industry,
        subject: merged.translations?.subject || dup.translations.subject,
        country: merged.translations?.country || dup.translations.country,
      };
    }
  }

  merged.physicalCount = count;
  return merged;
};
