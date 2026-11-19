import { BusinessCardData } from '../types';

export const createVCardString = (cards: BusinessCardData[], includeSummaryNote: boolean = true): string => {
  let vCardString = '';

  cards.forEach((card) => {
    vCardString += 'BEGIN:VCARD\r\n';
    vCardString += 'VERSION:3.0\r\n';

    const familyName = card.lastName || '';
    const givenName = card.firstName || '';
    const prefix = card.prefix || '';
    vCardString += `N:${familyName};${givenName};;${prefix};\r\n`;

    const fullName = [prefix, givenName, familyName].filter(Boolean).join(' ') || card.company || 'Contact';
    vCardString += `FN:${fullName}\r\n`;

    const company = card.company || '';
    const department = card.department || '';
    if (company || department) {
      vCardString += `ORG:${company};${department}\r\n`;
    }

    if (card.title) {
      vCardString += `TITLE:${card.title}\r\n`;
    }

    if (card.phone) {
      const phones = card.phone
        .split(/[\/,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      phones.forEach((p) => {
        vCardString += `TEL;TYPE=WORK,VOICE:${p}\r\n`;
      });
    }

    if (card.fax) {
      const faxes = card.fax
        .split(/[\/,;\n]+/)
        .map((f) => f.trim())
        .filter(Boolean);
      faxes.forEach((f) => {
        vCardString += `TEL;TYPE=FAX:${f}\r\n`;
      });
    }

    if (card.email) {
      const emails = card.email
        .split(/[\/,;\n]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      emails.forEach((e) => {
        vCardString += `EMAIL;TYPE=PREF,INTERNET:${e}\r\n`;
      });
    }

    if (card.website) {
      vCardString += `URL:${card.website}\r\n`;
    }

    if (card.address || card.country) {
      const cleanAddress = (card.address || '').replace(/;/g, ',');
      const country = card.country || '';
      vCardString += `ADR;TYPE=WORK:;;${cleanAddress};;;;${country}\r\n`;
    }

    if (includeSummaryNote) {
      const notesParts: string[] = [];
      if (card.summary) {
        notesParts.push(card.summary);
      }
      notesParts.push('Scanned by BizMind');
      if (notesParts.length > 0) {
        const noteContent = notesParts.join('\n\n').replace(/\n/g, '\\n');
        vCardString += `NOTE:${noteContent}\r\n`;
      }
    }

    vCardString += 'END:VCARD\r\n';
  });

  return vCardString;
};

export const createVCardFile = (cards: BusinessCardData[]): File => {
  const vCardString = createVCardString(cards, true);
  const blob = new Blob([vCardString], { type: 'text/vcard;charset=utf-8' });
  const fileName =
    cards.length === 1
      ? `${cards[0].firstName || 'Card'}_${cards[0].lastName || 'Contact'}.vcf`
      : `BizMind_Contacts_${new Date().toISOString().split('T')[0]}.vcf`;

  return new File([blob], fileName, { type: blob.type });
};
