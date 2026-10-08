
import { useState, useCallback } from 'react';
import { BusinessCardData, ExportMode } from '../../types';
import { getCardById, saveCardToDB, getCardsMetadataFromDB } from '../../services/dbService';
import { createVCardFile } from '../../services/vcardService';
import { createBatchExportZip } from '../../services/zipService';
import { createExcelFile, parseExcelImport } from '../../services/excelService';
import { useToast } from '../../components/ToastProvider';
import { normalizeCountry } from '../../utils/countries';

// Helper to find object value by case-insensitive key
const getValue = (row: any, keys: string[]): string | undefined => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
        const match = rowKeys.find(rk => rk.toLowerCase() === k.toLowerCase());
        if (match && row[match]) return String(row[match]).trim();
    }
    return undefined;
};

export const useImportExport = (
  cards: BusinessCardData[],
  setCards: React.Dispatch<React.SetStateAction<BusinessCardData[]>>,
  formData: BusinessCardData | null,
  isMobile: boolean,
  runBackgroundSummaryCheck: (cardsToCheck: BusinessCardData[]) => Promise<void>
) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { addToast } = useToast();

  const handleExport = async (mode: ExportMode, overrideCards?: BusinessCardData[]) => {
    let targetCardsMetadata: BusinessCardData[] = [];
    
    if (overrideCards && overrideCards.length > 0) {
        targetCardsMetadata = overrideCards;
    } else if (mode === 'single') {
        if (!formData) return;
        targetCardsMetadata = [formData];
    } else if (mode === 'employer' || mode === 'selected_employer') {
        targetCardsMetadata = cards.filter(c => c.category === 'employer');
    } else if (mode === 'academic' || mode === 'selected_academic') {
        targetCardsMetadata = cards.filter(c => c.category === 'academic');
    } else if (mode === 'staff' || mode === 'selected_staff') {
        targetCardsMetadata = cards.filter(c => c.category === 'staff');
    } else {
        targetCardsMetadata = cards;
    }

    if (targetCardsMetadata.length === 0) { 
        addToast({ type: 'warning', message: "無符合資料可匯出" }); 
        return; 
    }
    
    setIsExporting(true);
    setShowExportMenu(false);

    try {
        const fullCards = await Promise.all(
            targetCardsMetadata.map(async (meta) => {
                if (mode === 'single' && formData && formData.id === meta.id && formData.imageUrl) {
                    return formData;
                }
                const fullData = await getCardById(meta.id);
                return fullData || meta; 
            })
        );

        if (mode === 'json' || mode === 'full_backup') {
            const jsonString = JSON.stringify(fullCards, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = mode === 'full_backup' 
                ? `EcoScan_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`
                : `EcoScan_Export_JSON_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setIsExporting(false);
            return;
        }

        if (mode === 'vcard') {
            const vCardFile = createVCardFile(fullCards);
            const url = URL.createObjectURL(vCardFile);
            if (isMobile) {
                window.open(url, '_blank');
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = vCardFile.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
            setIsExporting(false);
            return;
        }

        if (mode === 'zip') {
            const zipFile = await createBatchExportZip(fullCards);
            const url = URL.createObjectURL(zipFile);
            const a = document.createElement('a');
            a.href = url;
            a.download = zipFile.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setIsExporting(false);
            return;
        }

        const excelFile = await createExcelFile(fullCards, mode);
        const url = URL.createObjectURL(excelFile);
        const a = document.createElement('a');
        a.href = url; a.download = excelFile.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        addToast({ type: 'success', message: "匯出成功" });
    } catch (err: any) { 
        addToast({ type: 'error', message: "匯出失敗：" + err.message }); 
    } finally { 
        setIsExporting(false); 
    }
  };

  const handleJsonImport = useCallback(async (file: File) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonStr = e.target?.result as string;
                const data = JSON.parse(jsonStr);
                const items = Array.isArray(data) ? data : [data];
                let count = 0;
                const importedItems: BusinessCardData[] = [];

                for (const item of items) {
                    if (item.id && (item.firstName || item.lastName || item.company)) {
                        if (item.phone && typeof item.phone === 'string') {
                            item.phone = item.phone.split('/')
                                .map((p: string) => p.replace(/[-\s]/g, ''))
                                .filter((p: string) => p.length > 0)
                                .join(' / ');
                        }
                        if (item.fax && typeof item.fax === 'string') {
                            item.fax = item.fax.split('/')
                                .map((p: string) => p.replace(/[-\s]/g, ''))
                                .filter((p: string) => p.length > 0)
                                .join(' / ');
                        } else if (!item.fax) {
                            item.fax = '';
                        }

                        if (item.country) {
                            item.country = normalizeCountry(item.country);
                        }
                        if (item.translations?.country) {
                            item.translations.country = normalizeCountry(item.translations.country);
                        }

                        await saveCardToDB(item as BusinessCardData);
                        importedItems.push(item as BusinessCardData);
                        count++;
                    }
                }
                addToast({ type: 'success', message: `成功從 JSON 備份還原 ${count} 筆資料 (含圖片)！` });
                const savedCards = await getCardsMetadataFromDB();
                setCards(savedCards.sort((a, b) => b.scannedAt - a.scannedAt));
                runBackgroundSummaryCheck(importedItems);
                resolve();
            } catch (err: any) {
                console.error(err);
                addToast({ type: 'error', message: "JSON 還原失敗：檔案格式錯誤" });
                reject(err);
            }
        };
        reader.readAsText(file);
    });
  }, [setCards, runBackgroundSummaryCheck]);

  const handleCsvImport = useCallback(async (file: File) => {
    try {
        const data = await parseExcelImport(file);
        let count = 0;
        const importedItems: BusinessCardData[] = [];
        
        for (const row of data) {
            const hasBasicInfo = row.firstName || row.lastName || row.company || row['名稱'];
            if (hasBasicInfo) {
                let parsedScannedAt = Date.now();
                if (row.scannedAt) {
                    const parsed = new Date(row.scannedAt).getTime();
                    if (!isNaN(parsed)) parsedScannedAt = parsed;
                    else if (typeof row.scannedAt === 'number') parsedScannedAt = row.scannedAt;
                }

                const item: BusinessCardData = {
                    id: row.SYSTEM_ID || crypto.randomUUID(),
                    scannedAt: parsedScannedAt,
                    category: row.category || 'other',
                    source: row.source || '',
                    firstName: row.firstName || '',
                    lastName: row.lastName || '',
                    prefix: row.prefix || '',
                    title: row.title || row.job_title || '',
                    company: row.company || '',
                    department: row.department || '',
                    industry: row.industry || '',
                    country: normalizeCountry(row.country || ''),
                    email: row.email || '',
                    phone: row.phone || '',
                    fax: row.fax || '',
                    subject: row.subject || '',
                    website: row.website || '',
                    address: row.address || '',
                    summary: row.summary || '',
                    reasoning: row.reasoning || '',
                    notes: row.notes || '',
                    imageUrl: getValue(row, ['image_url', 'Image URL', 'imageUrl']) || '',
                    syncStatus: row.syncStatus || (getValue(row, ['image_url', 'Image URL', 'imageUrl'])?.startsWith('http') ? 'firebase' : 'local'),
                    translations: {
                        title: row.trans_title || '',
                        company: row.trans_company || '',
                        department: row.trans_dept || '',
                        industry: row.trans_ind || '',
                        subject: row.trans_subj || '',
                        country: normalizeCountry(row.trans_ctry || '')
                    }
                };

                if (item.phone && typeof item.phone === 'string') {
                    item.phone = item.phone.split('/')
                        .map((p: string) => p.replace(/[-\s]/g, ''))
                        .filter((p: string) => p.length > 0)
                        .join(' / ');
                }
                if (item.fax && typeof item.fax === 'string') {
                    item.fax = item.fax.split('/')
                        .map((p: string) => p.replace(/[-\s]/g, ''))
                        .filter((p: string) => p.length > 0)
                        .join(' / ');
                } else if (!item.fax) {
                    item.fax = '';
                }

                await saveCardToDB(item);
                importedItems.push(item);
                count++;
            }
        }
        addToast({ type: 'success', message: `成功從 CSV 備份還原 ${count} 筆資料 (含圖片)！` });
        const savedCards = await getCardsMetadataFromDB();
        setCards(savedCards.sort((a, b) => b.scannedAt - a.scannedAt));
        runBackgroundSummaryCheck(importedItems);
    } catch (err) {
        console.error(err);
        addToast({ type: 'error', message: "CSV 還原失敗：檔案格式錯誤" });
    }
  }, [setCards, runBackgroundSummaryCheck]);

  return {
    isExporting,
    showExportMenu,
    setShowExportMenu,
    handleExport,
    handleJsonImport,
    handleCsvImport
  };
};
