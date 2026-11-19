import { BusinessCardData, ExportMode, CATEGORY_LABELS } from '../types';
import { normalizeCountry } from '../utils/countries';
import {
  DEFAULT_CARD_SOURCE,
  selectBestQsEmail,
  inferCountryFromCard,
} from '../utils/qsValidation';

const splitValues = (str: string): string[] => {
  if (!str) return [];
  return str
    .split(/[\/\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const selectSinglePhone = (phoneStr: string): string => {
  const phones = splitValues(phoneStr);
  return phones.length > 0 ? phones[0] : '';
};

const selectBestEmail = (emailStr: string, category: string): string => {
  const emails = splitValues(emailStr);
  if (emails.length === 0) return '';
  if (emails.length === 1) return emails[0];

  const eduEmail = emails.find((e) => e.toLowerCase().includes('.edu'));
  const nonEduEmail = emails.find((e) => !e.toLowerCase().includes('.edu'));

  if (category === 'academic') {
    return eduEmail || emails[0];
  }
  return nonEduEmail || emails[0];
};

export const createExcelFile = async (
  dataToExport: BusinessCardData[],
  mode: ExportMode
): Promise<File> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const formatDate = (ts: number) => new Date(ts).toLocaleString();
  const todayStr = new Date().toISOString().split('T')[0];

  const mapContactRow = (c: BusinessCardData) => ({
    Category: CATEGORY_LABELS[c.category || 'other']?.short || '一般聯絡人',
    Prefix: c.prefix || '',
    'First Name': c.firstName || '',
    'Last Name': c.lastName || '',
    'Job Title': c.title || '',
    Department: c.department || '',
    'Company / Organization': c.company || '',
    Industry: c.industry || '',
    Subject: c.subject || '',
    'Country / Region':
      inferCountryFromCard(c) || normalizeCountry(c.country || c.translations?.country) || '',
    Email: selectBestQsEmail(c.email, c.category) || selectBestEmail(c.email, c.category),
    Phone: selectSinglePhone(c.phone),
    Fax: selectSinglePhone(c.fax || ''),
    Website: c.website || '',
    Address: c.address || '',
    Source: (c.source || '').trim() || DEFAULT_CARD_SOURCE,
    Tags: (c.tags || []).join(', '),
  });

  if (mode === 'qs_ready_all' || mode === 'selected_qs') {
    const employers = dataToExport.filter((c) => c.category === 'employer');
    const academics = dataToExport.filter((c) => c.category === 'academic');
    const staff = dataToExport.filter((c) => c.category === 'staff');

    const wsAll = XLSX.utils.json_to_sheet(dataToExport.map(mapContactRow));
    XLSX.utils.book_append_sheet(wb, wsAll, 'All_Contacts');

    if (employers.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(employers.map(mapContactRow)),
        'Business_Partners'
      );
    }
    if (academics.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(academics.map(mapContactRow)),
        'Academic_Experts'
      );
    }
    if (staff.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(staff.map(mapContactRow)),
        'Organizations'
      );
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const name =
      mode === 'qs_ready_all'
        ? `BizMind_Verified_Contacts_${todayStr}.xlsx`
        : `BizMind_Selected_Contacts_${todayStr}.xlsx`;
    return new File([blob], name, { type: blob.type });
  }

  if (mode === 'employer' || mode === 'selected_employer') {
    const target =
      mode === 'employer'
        ? dataToExport.filter((c) => c.category === 'employer')
        : dataToExport;
    const ws = XLSX.utils.json_to_sheet(target.map(mapContactRow));
    XLSX.utils.book_append_sheet(wb, ws, 'Business_Partners');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return new File([blob], `BizMind_Business_Partners_${todayStr}.xlsx`, { type: blob.type });
  }

  if (mode === 'academic' || mode === 'selected_academic') {
    const target =
      mode === 'academic'
        ? dataToExport.filter((c) => c.category === 'academic')
        : dataToExport;
    const ws = XLSX.utils.json_to_sheet(target.map(mapContactRow));
    XLSX.utils.book_append_sheet(wb, ws, 'Academic_Experts');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return new File([blob], `BizMind_Academic_Experts_${todayStr}.xlsx`, { type: blob.type });
  }

  if (mode === 'staff' || mode === 'selected_staff') {
    const target =
      mode === 'staff' ? dataToExport.filter((c) => c.category === 'staff') : dataToExport;
    const ws = XLSX.utils.json_to_sheet(target.map(mapContactRow));
    XLSX.utils.book_append_sheet(wb, ws, 'Organizations');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return new File([blob], `BizMind_Organizations_${todayStr}.xlsx`, { type: blob.type });
  }

  if (mode === 'all_clean') {
    const ws = XLSX.utils.json_to_sheet(dataToExport.map(mapContactRow));
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return new File([blob], `BizMind_Contacts_${todayStr}.xlsx`, { type: blob.type });
  }

  if (mode === 'csv' || mode === 'selected_csv') {
    const csvRows = dataToExport.map((c) => ({
      SYSTEM_ID: c.id,
      scannedAt: c.scannedAt,
      category: c.category,
      source: c.source,
      tags: (c.tags || []).join(', '),
      firstName: c.firstName,
      lastName: c.lastName,
      prefix: c.prefix,
      title: c.title,
      company: c.company,
      department: c.department,
      industry: c.industry,
      country: c.country,
      email: c.email,
      phone: c.phone,
      fax: c.fax || '',
      subject: c.subject,
      website: c.website,
      address: c.address,
      summary: c.summary || '',
      reasoning: c.reasoning,
      notes: c.notes || '',
      trans_title: c.translations?.title || '',
      trans_company: c.translations?.company || '',
      trans_dept: c.translations?.department || '',
      trans_ind: c.translations?.industry || '',
      trans_subj: c.translations?.subject || '',
      trans_ctry: c.translations?.country || '',
      'Image URL': c.imageUrl || '',
      'Back Image URL': c.backImageUrl || '',
    }));
    const wsCsv = XLSX.utils.json_to_sheet(csvRows);
    XLSX.utils.book_append_sheet(wb, wsCsv, 'BizMind_Contacts');
    const csvOutput = XLSX.write(wb, { bookType: 'csv', type: 'string' });
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvOutput], { type: 'text/csv;charset=utf-8' });
    return new File([blob], `BizMind_Backup_${todayStr}.csv`, { type: blob.type });
  }

  // Full details including translations, notes & AI summary
  const fullRows = dataToExport.map((c) => ({
    ...mapContactRow(c),
    'Translated Title': c.translations?.title || '',
    'Translated Organization': c.translations?.company || '',
    'Translated Department': c.translations?.department || '',
    'AI Summary': c.summary || '',
    Notes: c.notes || '',
    'Scanned At': formatDate(c.scannedAt),
  }));
  const wsFull = XLSX.utils.json_to_sheet(fullRows);
  XLSX.utils.book_append_sheet(wb, wsFull, 'Full_Contacts');
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return new File([blob], `BizMind_Full_Details_${todayStr}.xlsx`, { type: blob.type });
};

export const parseExcelImport = async (file: File): Promise<any[]> => {
  const XLSX = await import('xlsx');
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
};
