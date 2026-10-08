
import JSZip from 'jszip';
import { BusinessCardData } from '../types';
import { createExcelFile } from './excelService';
import { createVCardFile } from './vcardService';

// Helper to get formatted filename
const getFormattedName = (card: BusinessCardData): string => {
    const firstName = (card.firstName || '').trim();
    const lastName = (card.lastName || '').trim();
    const company = (card.company || '').trim();

    // Regex for Chinese characters
    const chineseRegex = /[\u4e00-\u9fa5]/;
    
    // Helper to separate Chinese and Non-Chinese parts
    const splitName = (str: string) => {
        let chinese = '';
        let other = '';
        // Use Array.from to handle surrogate pairs correctly
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

    // Process LastName
    const lnParts = splitName(lastName);
    cName += lnParts.chinese;
    if (lnParts.other) eName += (eName ? ' ' : '') + lnParts.other;

    // Process FirstName
    const fnParts = splitName(firstName);
    cName += fnParts.chinese;
    if (fnParts.other) eName += (eName ? ' ' : '') + fnParts.other;

    // Construct final name
    let finalName = '';
    if (cName && eName) {
        finalName = `${cName} (${eName})`;
    } else if (cName) {
        finalName = cName;
    } else if (eName) {
        finalName = eName;
    } else {
        // Fallback to company or default
        finalName = company || 'Unknown_Card';
    }

    // Sanitize filename (remove illegal chars for filesystem)
    return finalName.replace(/[\\/:*?"<>|]/g, '_').trim();
};

export const createBatchExportZip = async (cards: BusinessCardData[]): Promise<File> => {
    const zip = new JSZip();
    const dateStr = new Date().toISOString().split('T')[0];
    const rootFolder = zip.folder(`EcoScan_Export_${dateStr}`);
    
    if (!rootFolder) throw new Error("Failed to create zip folder");

    // 1. Add Excel Summary (All Data)
    const excelFile = await createExcelFile(cards, 'all_original');
    rootFolder.file(`All_Data_${dateStr}.xlsx`, excelFile);

    // 2. Add Combined vCard (All Contacts)
    const combinedVCard = createVCardFile(cards);
    rootFolder.file(`All_Contacts_(請使用應用程式批量匯入)_${dateStr}.vcf`, combinedVCard);

    // 3. Add Individual vCards Folder
    const vCardsFolder = rootFolder.folder("individual_vcards");
    if (vCardsFolder) {
        cards.forEach(card => {
            const singleVCard = createVCardFile([card]);
            const safeName = getFormattedName(card);
            vCardsFolder.file(`${safeName}_${card.id.substring(0, 4)}.vcf`, singleVCard);
        });
    }

    // 4. Add Images Folder
    const imagesFolder = rootFolder.folder("images");
    if (imagesFolder) {
        cards.forEach(card => {
            if (card.imageUrl && card.imageUrl.startsWith('data:image')) {
                try {
                    const base64Data = card.imageUrl.split(',')[1];
                    const ext = card.imageUrl.substring(card.imageUrl.indexOf('/') + 1, card.imageUrl.indexOf(';'));
                    const safeName = getFormattedName(card);
                    imagesFolder.file(`${safeName}_${card.id.substring(0, 4)}.${ext}`, base64Data, { base64: true });
                } catch (e) {
                    console.warn(`Failed to add image for card ${card.id} to zip`, e);
                }
            }
        });
    }

    // Generate ZIP file
    const content = await zip.generateAsync({ type: "blob" });
    return new File([content], `EcoScan_Batch_Export_${dateStr}.zip`, { type: "application/zip" });
};
