
import { BusinessCardData } from '../types';

export const createVCardFile = (cards: BusinessCardData[]): File => {
  let vCardString = '';

  cards.forEach(card => {
    vCardString += 'BEGIN:VCARD\r\n';
    vCardString += 'VERSION:3.0\r\n';
    
    // Name: Family Name; Given Name; Additional Names; Prefixes; Suffixes
    const familyName = card.lastName || '';
    const givenName = card.firstName || '';
    const prefix = card.prefix || '';
    vCardString += `N:${familyName};${givenName};;${prefix};\r\n`;
    
    // Full Name
    const fullName = [prefix, givenName, familyName].filter(Boolean).join(' ');
    vCardString += `FN:${fullName}\r\n`;
    
    // Organization: Company; Department
    const company = card.company || '';
    const department = card.department || '';
    if (company || department) {
        vCardString += `ORG:${company};${department}\r\n`;
    }
    

    // Phone
    if (card.phone) {
        // Handle multiple phones if separated by comma/newline
        const phones = card.phone.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
        phones.forEach(p => {
            vCardString += `TEL;TYPE=WORK,VOICE:${p}\r\n`;
        });
    }
    
    // Fax
    if (card.fax) {
         const faxes = card.fax.split(/[,;\n]+/).map(f => f.trim()).filter(Boolean);
         faxes.forEach(f => {
             vCardString += `TEL;TYPE=FAX:${f}\r\n`;
         });
    }
    
    // Email
    if (card.email) {
        const emails = card.email.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean);
        emails.forEach(e => {
            vCardString += `EMAIL;TYPE=PREF,INTERNET:${e}\r\n`;
        });
    }
    
    // Website
    if (card.website) {
        vCardString += `URL:${card.website}\r\n`;
    }
    
    // Address
    if (card.address || card.country) {
        // ADR format: ;;Street;City;Region;Zip;Country
        // Since we only have a single address string, we'll put it in the Street field
        // and append Country if available.
        // Escaping semicolons in address is good practice but simple replacement here.
        const cleanAddress = (card.address || '').replace(/;/g, ',');
        const country = card.country || '';
        vCardString += `ADR;TYPE=WORK:;;${cleanAddress};;;;${country}\r\n`;
    }
    
    // Notes (Use only Summary as requested)
    const notesParts = [];
    if (card.summary) {
        notesParts.push(card.summary);
    }
    
    // Add Branding
    notesParts.push('Scanned by ECOSCAN');
    
    if (notesParts.length > 0) {
        // Replace newlines with literal \n
        const noteContent = notesParts.join('\n\n').replace(/\n/g, '\\n');
        vCardString += `NOTE:${noteContent}\r\n`;
    }
    
    // Photo removed as per request
    // ECOSCAN branding added to notes

    vCardString += 'END:VCARD\r\n\r\n';
  });

  const blob = new Blob([vCardString], { type: 'text/vcard;charset=utf-8' });
  const fileName = cards.length === 1 
    ? `${cards[0].firstName || 'Card'}_${cards[0].lastName || ''}.vcf`
    : `EcoScan_Export_${new Date().toISOString().split('T')[0]}.vcf`;
    
  return new File([blob], fileName, { type: blob.type });
};
