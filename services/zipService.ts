import { BusinessCardData } from '../types';
import { createExcelFile } from './excelService';
import { createVCardFile } from './vcardService';

const getFormattedName = (card: BusinessCardData): string => {
  const firstName = (card.firstName || '').trim();
  const lastName = (card.lastName || '').trim();
  const company = (card.company || '').trim();

  const chineseRegex = /[\u4e00-\u9fa5]/;

  const splitName = (str: string) => {
    let chinese = '';
    let other = '';
    for (const char of Array.from(str)) {
      if (chineseRegex.test(char)) {
        chinese += char;
      } else {
        other += char;
      }
    }
    return { chinese: chinese.trim(), other: other.trim() };
  };

  let cName = '';
  let eName = '';

  const lnParts = splitName(lastName);
  cName += lnParts.chinese;
  if (lnParts.other) eName += (eName ? ' ' : '') + lnParts.other;

  const fnParts = splitName(firstName);
  cName += fnParts.chinese;
  if (fnParts.other) eName += (eName ? ' ' : '') + fnParts.other;

  let finalName = '';
  if (cName && eName) {
    finalName = `${cName} (${eName})`;
  } else if (cName) {
    finalName = cName;
  } else if (eName) {
    finalName = eName;
  } else {
    finalName = company || 'Unknown_Card';
  }

  return finalName.replace(/[\\/:*?"<>|]/g, '_').trim();
};

export const createBatchExportZip = async (cards: BusinessCardData[]): Promise<File> => {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const dateStr = new Date().toISOString().split('T')[0];
  const rootFolder = zip.folder(`BizMind_Export_${dateStr}`);

  if (!rootFolder) throw new Error('Failed to create zip folder');

  const excelFile = await createExcelFile(cards, 'all_original');
  rootFolder.file(`All_Contacts_${dateStr}.xlsx`, excelFile);

  const combinedVCard = createVCardFile(cards);
  rootFolder.file(`All_Contacts_${dateStr}.vcf`, combinedVCard);

  const vCardsFolder = rootFolder.folder('individual_vcards');
  if (vCardsFolder) {
    cards.forEach((card) => {
      const singleVCard = createVCardFile([card]);
      const safeName = getFormattedName(card);
      vCardsFolder.file(`${safeName}_${card.id.substring(0, 4)}.vcf`, singleVCard);
    });
  }

  const imagesFolder = rootFolder.folder('images');
  if (imagesFolder) {
    cards.forEach((card) => {
      if (card.imageUrl && card.imageUrl.startsWith('data:image')) {
        try {
          const base64Data = card.imageUrl.split(',')[1];
          const ext = card.imageUrl.substring(
            card.imageUrl.indexOf('/') + 1,
            card.imageUrl.indexOf(';')
          );
          const safeName = getFormattedName(card);
          imagesFolder.file(`${safeName}_${card.id.substring(0, 4)}.${ext}`, base64Data, {
            base64: true,
          });
        } catch (e) {
          console.warn(`Failed to add image for card ${card.id} to zip`, e);
        }
      }
    });
  }

  const content = await zip.generateAsync({ type: 'blob' });
  return new File([content], `BizMind_Batch_Export_${dateStr}.zip`, { type: 'application/zip' });
};
