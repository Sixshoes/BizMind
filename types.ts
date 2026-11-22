export interface ImageAsset {
  id: string;
  storagePath: string;
  downloadUrl: string;
  sha256?: string;
  refCount: number;
  status: 'active' | 'pending_delete' | 'deleted';
  deleteAfter?: number;
  createdAt: number;
  updatedAt: number;
}

export type SyncStatus = 'local' | 'firebase' | 'notion';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type ContactCategory = 'employer' | 'academic' | 'staff' | 'other';

export type FollowUpStatus = 'new' | 'emailed' | 'in_progress' | 'partner';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface CardActivityItem {
  id: string;
  at: number;
  type: 'created' | 'emailed' | 'note' | 'voice' | 'enriched' | 'status';
  text: string;
}

export interface MyDigitalCardProfile {
  prefix: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  department: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  notes: string;
  updatedAt?: number;
}

export const CATEGORY_LABELS: Record<ContactCategory, { short: string; full: string; en: string }> = {
  employer: { short: '企業夥伴', full: '企業夥伴 (Business)', en: 'Business Partner' },
  academic: { short: '學研專家', full: '學研專家 (Academic)', en: 'Academic & Expert' },
  staff: { short: '機關社團', full: '機關社團 (Organization)', en: 'Organization & NGO' },
  other: { short: '一般聯絡人', full: '一般聯絡人 (General)', en: 'General Contact' },
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, { label: string; colorCls: string }> = {
  new: {
    label: '新認識',
    colorCls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  emailed: {
    label: '已寄問候信',
    colorCls: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  in_progress: {
    label: '洽談跟進中',
    colorCls: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  partner: {
    label: '長期夥伴',
    colorCls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

export interface BusinessCardData {
  id: string;
  prefix: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  department: string;
  industry: string;
  country: string;
  email: string;
  phone: string;
  fax: string;
  subject: string;
  source: string;
  website: string;
  address: string;
  notes: string;
  tags?: string[];
  category: ContactCategory;
  reasoning: string;
  summary: string;
  scannedAt: number;
  updatedAt?: number;
  deletedAt?: number;
  originalFileName?: string;
  originalFileSize?: number;
  syncStatus: SyncStatus;
  ownerUid?: string;
  imageUrl?: string;
  imagePath?: string;
  imageId?: string;
  rotation?: number;
  backImageUrl?: string;
  backImagePath?: string;
  backImageId?: string;
  backRotation?: number;
  physicalCount?: number;
  followUpStatus?: FollowUpStatus;
  nextFollowUpAt?: number;
  activityLog?: CardActivityItem[];
  confidence?: {
    name?: ConfidenceLevel;
    title?: ConfidenceLevel;
    company?: ConfidenceLevel;
    email?: ConfidenceLevel;
    phone?: ConfidenceLevel;
  };
  translations?: {
    title?: string;
    company?: string;
    department?: string;
    industry?: string;
    subject?: string;
    country?: string;
  };
}

export interface ProcessingTask {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  base64?: string;
  batchIndex: number;
  previewUrl?: string;
}

export type ScanStatus = 'idle' | 'busy' | 'error';

export type ExportMode =
  | 'json'
  | 'excel'
  | 'vcard'
  | 'zip'
  | 'employer'
  | 'academic'
  | 'staff'
  | 'all'
  | 'single'
  | 'full_backup'
  | 'all_clean'
  | 'all_original'
  | 'csv'
  | 'selected_qs'
  | 'selected_employer'
  | 'selected_academic'
  | 'selected_staff'
  | 'selected_csv'
  | 'qs_ready_all';

export type SearchSortOption = 'name_asc' | 'name_desc' | 'company_asc' | 'date_desc' | 'date_asc';

export type SearchDisplayMode = 'table' | 'grid';

export interface SearchPageState {
  query: string;
  sortBy: SearchSortOption;
  isGrouped: boolean;
  filterHasEmail: boolean;
  filterHasPhone: boolean;
  filterHasBackImage?: boolean;
  filterCategory: 'all' | ContactCategory;
  filterCountry: string;
  filterTag?: string;
  filterSource?: string;
  displayMode?: SearchDisplayMode;
}

export interface FollowUpEmailDraft {
  subject: string;
  body: string;
}

export interface VoiceNoteResult {
  summaryBullet: string;
  suggestedTags: string[];
  suggestedFollowUpDays?: number | null;
}

export interface CardEnrichmentResult {
  companySummary?: string;
  industry?: string;
  website?: string;
  country?: string;
  sources: { title: string; url: string }[];
}

export type DualSideRelationType =
  | 'bilingual_mirror'
  | 'dual_role_same_person'
  | 'different_entity';

export type DualSideResolutionStrategy =
  | 'auto'
  | 'merge_concurrent'
  | 'split_into_two'
  | 'keep_image_only';

export interface BackSideExtractedFields {
  prefix?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  department?: string;
  industry?: string;
  country?: string;
  email?: string;
  subject?: string;
  phone?: string;
  fax?: string;
  website?: string;
  address?: string;
  notes?: string;
  translations?: {
    title?: string;
    company?: string;
    department?: string;
    industry?: string;
    subject?: string;
    country?: string;
  };
}

export interface BackSideExtractionResult {
  relationType: DualSideRelationType;
  hasDifferentTitle: boolean;
  hasDifferentOrg: boolean;
  hasDifferentPerson: boolean;
  conflictSummary?: string;
  recommendedBackRotation?: number;
  backOnly: BackSideExtractedFields;
  mergedSuggestion?: BackSideExtractedFields;
}

export interface DualSideConflictItem {
  card: BusinessCardData;
  extraction: BackSideExtractionResult;
  conflictReason: string;
  isDifferentPerson: boolean;
  isDifferentOrg: boolean;
}
