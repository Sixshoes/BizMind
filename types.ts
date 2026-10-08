
export interface ImageAsset {
  id: string;
  storagePath: string;
  downloadUrl: string;
  sha256?: string;
  refCount: number;
  status: 'active' | 'pending_delete' | 'deleted';
  deleteAfter?: number; // timestamp
  createdAt: number;
  updatedAt: number;
}

export type SyncStatus = 'local' | 'firebase' | 'notion';

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
  fax: string; // Added Fax field
  subject: string;
  source: string;
  website: string;
  address: string;
  notes: string;
  category: 'employer' | 'academic' | 'staff' | 'other';
  reasoning: string; // Internal classification logic
  summary: string;   // Public facing introduction
  scannedAt: number;
  originalFileName?: string;
  originalFileSize?: number;
  syncStatus: SyncStatus;   // Explicit sync status (local, firebase, notion)
  syncedToNotion?: boolean; // Keep for backward compatibility/migration
  imageUrl?: string;        // Public URL of the card image (Firebase or external)
  imageId?: string;         // New: Reference to ImageAsset
  rotation?: number;
  physicalCount?: number;   // Number of physical paper cards
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
  previewUrl?: string; // Added for thumbnail display
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
  | 'selected_csv';

export type SearchSortOption = 'name_asc' | 'name_desc' | 'company_asc' | 'date_desc' | 'date_asc';

export interface SearchPageState {
  query: string;
  sortBy: SearchSortOption;
  isGrouped: boolean;
  filterHasEmail: boolean;
  filterHasPhone: boolean;
  filterCategory: 'all' | 'employer' | 'academic' | 'staff' | 'other';
  filterCountry: string;
}

