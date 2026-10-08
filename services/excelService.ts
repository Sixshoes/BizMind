
import { BusinessCardData, ExportMode } from '../types';
import { normalizeCountry } from '../utils/countries';

// Helper: split string by common separators
const splitValues = (str: string): string[] => {
    if (!str) return [];
    return str.split(/[\/\n,;]+/).map(s => s.trim()).filter(Boolean);
};

// Logic: Pick the first phone number available
const selectSinglePhone = (phoneStr: string): string => {
    const phones = splitValues(phoneStr);
    return phones.length > 0 ? phones[0] : '';
};

// Logic: Pick email based on category
const selectBestEmail = (emailStr: string, category: string): string => {
    const emails = splitValues(emailStr);
    if (emails.length === 0) return '';
    if (emails.length === 1) return emails[0];

    const eduEmail = emails.find(e => e.toLowerCase().includes('.edu'));
    const nonEduEmail = emails.find(e => !e.toLowerCase().includes('.edu'));

    if (category === 'academic') {
        // For academic, prefer .edu
        return eduEmail || emails[0];
    } else {
        // For employer/staff/other, prefer non .edu (business email)
        return nonEduEmail || emails[0];
    }
};

export const createExcelFile = async (dataToExport: BusinessCardData[], mode: ExportMode): Promise<File> => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const formatDate = (ts: number) => new Date(ts).toLocaleString();

    // Helper to format academic row
    const mapAcademicRow = (c: BusinessCardData) => ({
        'Source': c.source || 'QS Hub Scanner',
        'Title': c.prefix || '',
        'First Name': c.firstName || '',
        'Last Name': c.lastName || '',
        'Job Title': c.title || '',
        'Department': c.department || '',
        'Institution': c.company || '',
        'Country or Territory': normalizeCountry(c.country || c.translations?.country) || '',
        'Email': selectBestEmail(c.email, 'academic'),
        'Subject': c.subject || '',
        'Phone (Optional)': selectSinglePhone(c.phone),
        'Fax (Optional)': selectSinglePhone(c.fax || '')
    });

    // Helper to format employer row
    const mapEmployerRow = (c: BusinessCardData) => ({
        'Source': c.source || 'QS Hub Scanner',
        'Title': c.prefix || '',
        'First Name': c.firstName || '',
        'Last Name': c.lastName || '',
        'Position': c.title || '',
        'Industry': c.industry || '',
        'Company Name': c.company || '',
        'Country or Territory': normalizeCountry(c.country || c.translations?.country) || '',
        'Email': selectBestEmail(c.email, c.category || 'employer'),
        'Phone (Optional)': selectSinglePhone(c.phone),
        'Fax (Optional)': selectSinglePhone(c.fax || '')
    });

    // Helper to format staff row
    const mapStaffRow = (c: BusinessCardData) => ({
        'Source': c.source || 'QS Hub Scanner',
        'Title': c.prefix || '',
        'First Name': c.firstName || '',
        'Last Name': c.lastName || '',
        'Position': c.title || '',
        'Department': c.department || '',
        'Institution / Company': c.company || '',
        'Country or Territory': normalizeCountry(c.country || c.translations?.country) || '',
        'Email': selectBestEmail(c.email, 'staff'),
        'Phone (Optional)': selectSinglePhone(c.phone),
        'Fax (Optional)': selectSinglePhone(c.fax || '')
    });

    if (mode === 'selected_qs') {
        // Multi-sheet QS export for selected contacts
        const employers = dataToExport.filter(c => c.category === 'employer' || c.category === 'other');
        const academics = dataToExport.filter(c => c.category === 'academic');
        const staff = dataToExport.filter(c => c.category === 'staff');

        if (employers.length > 0) {
            const wsEmployer = XLSX.utils.json_to_sheet(employers.map(mapEmployerRow));
            XLSX.utils.book_append_sheet(wb, wsEmployer, "QS_Employer");
        }
        if (academics.length > 0) {
            const wsAcademic = XLSX.utils.json_to_sheet(academics.map(mapAcademicRow));
            XLSX.utils.book_append_sheet(wb, wsAcademic, "QS_Academic");
        }
        if (staff.length > 0) {
            const wsStaff = XLSX.utils.json_to_sheet(staff.map(mapStaffRow));
            XLSX.utils.book_append_sheet(wb, wsStaff, "QS_Staff");
        }

        // Summary / All Sheet
        const allRows = dataToExport.map(c => ({
            'QS Category': c.category === 'other' ? 'Not QS' : c.category.toUpperCase(),
            'Prefix': c.prefix || '',
            'First Name': c.firstName || '',
            'Last Name': c.lastName || '',
            'Job Title': c.title || '',
            'Company / Institution': c.company || '',
            'Department': c.department || '',
            'Industry': c.industry || '',
            'Country or Territory': normalizeCountry(c.country) || '',
            'Email': selectBestEmail(c.email, c.category),
            'Phone': c.phone || '',
            'Fax': c.fax || '',
            'Subject': c.subject || '',
            'Notes': c.notes || '',
            'Summary': c.summary || ''
        }));
        const wsAll = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, wsAll, "All_Selected_QS");

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const name = `QS_Contacts_Selected_${new Date().toISOString().split('T')[0]}.xlsx`;
        return new File([blob], name, { type: blob.type });
    }

    if (mode === 'selected_employer') {
        const rows = dataToExport.map(mapEmployerRow);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "QS_Employer");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const name = `QS_Employer_Selected_${new Date().toISOString().split('T')[0]}.xlsx`;
        return new File([blob], name, { type: blob.type });
    }

    if (mode === 'selected_academic') {
        const rows = dataToExport.map(mapAcademicRow);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "QS_Academic");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const name = `QS_Academic_Selected_${new Date().toISOString().split('T')[0]}.xlsx`;
        return new File([blob], name, { type: blob.type });
    }

    if (mode === 'selected_staff') {
        const rows = dataToExport.map(mapStaffRow);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "QS_Staff");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const name = `QS_Staff_Selected_${new Date().toISOString().split('T')[0]}.xlsx`;
        return new File([blob], name, { type: blob.type });
    }

    if (mode === 'selected_csv') {
        const allRows = dataToExport.map(c => ({
            'Source': c.source || 'QS Hub Scanner',
            'Category': c.category === 'other' ? 'Not QS' : c.category,
            'Title': c.prefix || '',
            'First Name': c.firstName || '',
            'Last Name': c.lastName || '',
            'Job Title / Position': c.title || '',
            'Company / Institution': c.company || '',
            'Department': c.department || '',
            'Industry': c.industry || '',
            'Country or Territory': normalizeCountry(c.country) || '',
            'Email': selectBestEmail(c.email, c.category),
            'Subject': c.subject || '',
            'Phone': selectSinglePhone(c.phone),
            'Fax': selectSinglePhone(c.fax || '')
        }));
        const ws = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, "QS_Selected");
        const csvOutput = XLSX.write(wb, { bookType: 'csv', type: 'string' });
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvOutput], { type: 'text/csv;charset=utf-8' });
        const name = `QS_Contacts_Selected_${new Date().toISOString().split('T')[0]}.csv`;
        return new File([blob], name, { type: blob.type });
    }

    let exportData: any[] = [];
    
    // Map data based on Mode
    if (mode === 'single') {
        exportData = dataToExport.map(c => ({
            'First Name': c.firstName, 'Last Name': c.lastName, 'Title': c.title, 'Title (Trans)': c.translations?.title || '',
            'Company': c.company, 'Company (Trans)': c.translations?.company || '', 'Department': c.department, 'Department (Trans)': c.translations?.department || '',
            'Industry': c.industry, 'Email': c.email, 'Phone': c.phone, 'Fax': c.fax || '', 'Website': c.website, 'Address': c.address, 'Country': c.country,
            'Subject': c.subject, 'Category': c.category === 'other' ? 'Not QS' : c.category, 'Summary': c.summary || '', 'Reasoning': c.reasoning, 'Notes': c.notes || '', 'Scan Date': formatDate(c.scannedAt), 'Source': c.source
        }));
    } else if (mode === 'full_backup' || mode === 'csv') {
        // Full Backup includes Image Base64 for restoration and ALL data
        exportData = dataToExport.map(c => ({
            'SYSTEM_ID': c.id, 'scannedAt': c.scannedAt, 'category': c.category, 'source': c.source,
            'firstName': c.firstName, 'lastName': c.lastName, 'prefix': c.prefix, 'title': c.title, 'company': c.company,
            'department': c.department, 'industry': c.industry, 'country': c.country, 
            'email': c.email, // Keep original full string
            'phone': c.phone, // Keep original full string
            'fax': c.fax || '', 
            'subject': c.subject, 'website': c.website, 'address': c.address, 
            'summary': c.summary || '', 'reasoning': c.reasoning,
            'notes': c.notes || '',
            'trans_title': c.translations?.title || '', 'trans_company': c.translations?.company || '', 'trans_dept': c.translations?.department || '',
            'trans_ind': c.translations?.industry || '', 'trans_subj': c.translations?.subject || '', 'trans_ctry': c.translations?.country || '',
            'Image URL': c.imageUrl 
        }));
    } else if (mode === 'all_clean') {
        exportData = dataToExport.map(c => ({
            'Category': c.category === 'other' ? 'Not QS' : c.category, 'First Name': c.firstName, 'Last Name': c.lastName, 'Title': c.title, 'Company': c.company,
            'Department': c.department, 'Industry': c.industry, 'Subject': c.subject, 'Email': c.email, 'Phone': c.phone, 'Fax': c.fax || '',
            'Website': c.website, 'Address': c.address, 'Country': c.country, 'Summary': c.summary || '', 'Notes': c.notes || '', 'Scan Date': formatDate(c.scannedAt),
            'Image URL': c.imageUrl
        }));
    } else if (mode === 'all_original') {
        exportData = dataToExport.map(c => ({
             'Category': c.category === 'other' ? 'Not QS' : c.category, 'First Name': c.firstName, 'Last Name': c.lastName,
             'Title (Original)': c.title, 'Title (Note)': c.translations?.title || '',
             'Company (Original)': c.company, 'Company (Note)': c.translations?.company || '',
             'Department (Original)': c.department, 'Department (Note)': c.translations?.department || '',
             'Industry': c.industry, 'Industry (Note)': c.translations?.industry || '',
             'Email': c.email, 'Phone': c.phone, 'Fax': c.fax || '', 'Address': c.address, 'Summary': c.summary || '', 'Reasoning': c.reasoning, 'Notes': c.notes || ''
        }));
    } else if (mode === 'academic') {
        // STRICT QS ACADEMIC FORMAT (Filtered)
        exportData = dataToExport.map(mapAcademicRow);
    } else {
        // STRICT QS EMPLOYER / STAFF FORMAT (Filtered)
        exportData = dataToExport.map(mapEmployerRow);
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "QS_Export");

    if (mode === 'csv') {
        // Generate CSV with BOM for Excel compatibility
        const csvOutput = XLSX.write(wb, { bookType: 'csv', type: 'string' });
        // Add BOM manually
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvOutput], { type: 'text/csv;charset=utf-8' });
        const name = `EcoScan_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.csv`;
        return new File([blob], name, { type: blob.type });
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const name = mode === 'full_backup' ? `EcoScan_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.xlsx` : `QS_Export_${mode}_${new Date().toISOString().split('T')[0]}.xlsx`;
    return new File([blob], name, { type: blob.type });
};

export const parseExcelImport = async (file: File): Promise<any[]> => {
    const XLSX = await import('xlsx');
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws);
};
