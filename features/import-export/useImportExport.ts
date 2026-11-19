import React, { useState, useCallback } from 'react';
import { BusinessCardData, ExportMode } from '../../types';
import { getCardById, saveAllCardsToDB, getCardsMetadataFromDB } from '../../services/dbService';
import { createVCardFile } from '../../services/vcardService';
import { createBatchExportZip } from '../../services/zipService';
import { createExcelFile, parseExcelImport } from '../../services/excelService';
import { useToast } from '../../components/ToastProvider';
import { normalizeCountry } from '../../utils/countries';
import { DEFAULT_CARD_SOURCE, getBoundQsSubmissionList } from '../../utils/qsValidation';

const getValue = (row: any, keys: string[]): string | undefined => {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const match = rowKeys.find((rk) => rk.toLowerCase() === k.toLowerCase());
    if (match && row[match]) return String(row[match]).trim();
  }
  return undefined;
};

const triggerBlobDownload = (blob: Blob | File, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const useImportExport = (
  cards: BusinessCardData[],
  setCards: React.Dispatch<React.SetStateAction<BusinessCardData[]>>,
  formData: BusinessCardData | null,
  _isMobile: boolean,
  runBackgroundSummaryCheck: (cardsToCheck: BusinessCardData[]) => Promise<void>
) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { addToast } = useToast();

  const handleExport = async (mode: ExportMode, overrideCards?: BusinessCardData[]) => {
    let targetCardsMetadata: BusinessCardData[] = [];

    let boundInfo: { academicCount: number; employerCount: number } | null = null;

    if (mode === 'qs_ready_all') {
      const sourceList = overrideCards && overrideCards.length > 0 ? overrideCards : cards;
      const bound = getBoundQsSubmissionList(sourceList);
      targetCardsMetadata = bound.readyCards;
      boundInfo = {
        academicCount: bound.academicCards.length,
        employerCount: bound.employerCards.length,
      };
    } else if (overrideCards && overrideCards.length > 0) {
      targetCardsMetadata = overrideCards;
    } else if (mode === 'single') {
      if (!formData) return;
      targetCardsMetadata = [formData];
    } else if (mode === 'employer') {
      targetCardsMetadata = getBoundQsSubmissionList(cards).employerCards;
    } else if (mode === 'academic') {
      targetCardsMetadata = getBoundQsSubmissionList(cards).academicCards;
    } else if (mode === 'selected_employer') {
      targetCardsMetadata = cards.filter((c) => c.category === 'employer');
    } else if (mode === 'selected_academic') {
      targetCardsMetadata = cards.filter((c) => c.category === 'academic');
    } else if (mode === 'staff' || mode === 'selected_staff') {
      targetCardsMetadata = cards.filter((c) => c.category === 'staff');
    } else {
      targetCardsMetadata = cards;
    }

    if (targetCardsMetadata.length === 0) {
      addToast({ type: 'warning', message: '目前無符合條件的合規名片可匯出' });
      return;
    }

    setIsExporting(true);
    setShowExportMenu(false);

    try {
      const fullCards = await Promise.all(
        targetCardsMetadata.map(async (meta) => {
          if (mode === 'single' && formData && formData.id === meta.id) {
            return formData;
          }
          const fullData = await getCardById(meta.id);
          return fullData || meta;
        })
      );

      if (mode === 'json' || mode === 'full_backup') {
        const jsonString = JSON.stringify(fullCards, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const fileName =
          mode === 'full_backup'
            ? `BizMind_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`
            : `BizMind_Export_JSON_${new Date().toISOString().split('T')[0]}.json`;
        triggerBlobDownload(blob, fileName);
        addToast({ type: 'success', message: 'JSON 備份匯出成功' });
        return;
      }

      if (mode === 'vcard') {
        const vCardFile = createVCardFile(fullCards);
        triggerBlobDownload(vCardFile, vCardFile.name);
        addToast({ type: 'success', message: 'vCard 通訊錄匯出成功' });
        return;
      }

      if (mode === 'zip') {
        const zipFile = await createBatchExportZip(fullCards);
        triggerBlobDownload(zipFile, zipFile.name);
        addToast({ type: 'success', message: 'ZIP 壓縮包匯出成功' });
        return;
      }

      const excelFile = await createExcelFile(fullCards, mode);
      triggerBlobDownload(excelFile, excelFile.name);
      if (mode === 'qs_ready_all' && boundInfo) {
        addToast({
          type: 'success',
          message: `已匯出驗證完成之聯絡人報表：共 ${fullCards.length} 筆`,
        });
      } else {
        addToast({ type: 'success', message: '報表匯出成功' });
      }
    } catch (err: any) {
      addToast({ type: 'error', message: '匯出失敗：' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleJsonImport = useCallback(
    async (file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const jsonStr = e.target?.result as string;
            const data = JSON.parse(jsonStr);
            const items = Array.isArray(data) ? data : [data];
            const importedItems: BusinessCardData[] = [];

            for (const item of items) {
              if (item.id && (item.firstName || item.lastName || item.company)) {
                if (item.phone && typeof item.phone === 'string') {
                  item.phone = item.phone
                    .split('/')
                    .map((p: string) => p.replace(/[-\s]/g, ''))
                    .filter((p: string) => p.length > 0)
                    .join(' / ');
                }
                if (item.fax && typeof item.fax === 'string') {
                  item.fax = item.fax
                    .split('/')
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
                if (!item.source) {
                  item.source = DEFAULT_CARD_SOURCE;
                }

                importedItems.push(item as BusinessCardData);
              }
            }

            if (importedItems.length > 0) {
              await saveAllCardsToDB(importedItems);
            }

            addToast({
              type: 'success',
              message: `成功從 JSON 備份還原 ${importedItems.length} 筆名片資料`,
            });
            const savedCards = await getCardsMetadataFromDB();
            setCards(savedCards.sort((a, b) => b.scannedAt - a.scannedAt));
            runBackgroundSummaryCheck(importedItems);
            resolve();
          } catch (err: any) {
            console.error(err);
            addToast({ type: 'error', message: 'JSON 還原失敗：檔案格式錯誤' });
            reject(err);
          }
        };
        reader.readAsText(file);
      });
    },
    [setCards, runBackgroundSummaryCheck, addToast]
  );

  const handleCsvImport = useCallback(
    async (file: File) => {
      try {
        const data = await parseExcelImport(file);
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

            const rawTags = getValue(row, ['tags', 'Tags']) || '';
            const parsedTags = rawTags
              ? rawTags
                  .split(/[,;]+/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              : undefined;

            const frontImgUrl = getValue(row, ['image_url', 'Image URL', 'imageUrl']) || '';
            const backImgUrl = getValue(row, ['back_image_url', 'Back Image URL', 'backImageUrl']) || undefined;

            const item: BusinessCardData = {
              id: row.SYSTEM_ID || crypto.randomUUID(),
              scannedAt: parsedScannedAt,
              category: row.category || 'other',
              source: row.source || DEFAULT_CARD_SOURCE,
              tags: parsedTags,
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
              imageUrl: frontImgUrl,
              backImageUrl: backImgUrl,
              syncStatus:
                row.syncStatus || (frontImgUrl.startsWith('http') ? 'firebase' : 'local'),
              translations: {
                title: row.trans_title || '',
                company: row.trans_company || '',
                department: row.trans_dept || '',
                industry: row.trans_ind || '',
                subject: row.trans_subj || '',
                country: normalizeCountry(row.trans_ctry || ''),
              },
            };

            if (item.phone && typeof item.phone === 'string') {
              item.phone = item.phone
                .split('/')
                .map((p: string) => p.replace(/[-\s]/g, ''))
                .filter((p: string) => p.length > 0)
                .join(' / ');
            }
            if (item.fax && typeof item.fax === 'string') {
              item.fax = item.fax
                .split('/')
                .map((p: string) => p.replace(/[-\s]/g, ''))
                .filter((p: string) => p.length > 0)
                .join(' / ');
            } else if (!item.fax) {
              item.fax = '';
            }

            importedItems.push(item);
          }
        }

        if (importedItems.length > 0) {
          await saveAllCardsToDB(importedItems);
        }

        addToast({
          type: 'success',
          message: `成功從 CSV/Excel 還原 ${importedItems.length} 筆名片資料`,
        });
        const savedCards = await getCardsMetadataFromDB();
        setCards(savedCards.sort((a, b) => b.scannedAt - a.scannedAt));
        runBackgroundSummaryCheck(importedItems);
      } catch (err) {
        console.error(err);
        addToast({ type: 'error', message: 'CSV 還原失敗：檔案格式錯誤' });
      }
    },
    [setCards, runBackgroundSummaryCheck, addToast]
  );

  return {
    isExporting,
    showExportMenu,
    setShowExportMenu,
    handleExport,
    handleJsonImport,
    handleCsvImport,
  };
};
