import PDFDocument from 'pdfkit';
import { getCurrencyDetails } from './billCalculationService.js';

/**
 * Generate PDF buffer from invoice data.
 * Pure in-memory streaming, perfectly suited for AWS Lambda memory execution without native browser dependencies.
 */
const BRAND = '#4F46E5';

const displayUrl = (url) => String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');

/**
 * `logo` is an optional PNG/JPEG Buffer. It is used in the page header, as a faint watermark
 * behind every page, and in the footer.
 */
export async function createInvoicePdfBuffer(billData, { logo = null } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const {
        invoiceNumber = 'INV-0001',
        billDate = new Date().toISOString().slice(0, 10),
        dueDate = '',
        billFrom = {},
        billTo = {},
        lineItems = [],
        subtotal = 0,
        taxRate = 0,
        taxAmount = 0,
        total = 0,
        accountDetail = {},
        notes = '',
        currency = 'USD',
        particulars = [],
      } = billData;

      const curr = getCurrencyDetails(currency);
      const symbol = curr.pdfSymbol || '$';

      // A corrupt logo must never prevent the invoice from being generated.
      let logoImg = null;
      if (logo) {
        try {
          logoImg = doc.openImage(logo);
        } catch (logoErr) {
          console.warn('Ignoring unreadable logo:', logoErr.message);
        }
      }

      const drawWatermark = () => {
        if (!logoImg) return;
        const box = 320;
        doc.save();
        doc.opacity(0.07);
        doc.image(logoImg, (doc.page.width - box) / 2, (doc.page.height - box) / 2, { fit: [box, box], align: 'center', valign: 'center' });
        doc.restore();
      };
      drawWatermark();
      doc.on('pageAdded', drawWatermark);

      const drawHeader = (title, titleSize, metaLines) => {
        doc.rect(0, 0, doc.page.width, 6).fill(BRAND);
        if (logoImg) {
          doc.image(logoImg, 40, 24, { fit: [170, 56], valign: 'center' });
        } else {
          doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text(billFrom.vendorName || 'Your Business', 40, 40, { width: 250 });
        }
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(titleSize).text(title, 250, 24, { width: 305, align: 'right' });
        doc.font('Helvetica').fontSize(10).fillColor('#475569');
        metaLines.forEach((line, i) => doc.text(line, 250, 54 + i * 14, { width: 305, align: 'right' }));
        doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, 98).lineTo(555, 98).stroke();
      };

      drawHeader('INVOICE', 26, [`Invoice #: ${invoiceNumber}`, `Date: ${billDate}`, ...(dueDate ? [`Due: ${dueDate}`] : [])]);

      // Section: Bill From and Bill To
      const startY = 120;
      doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold').text('BILLED FROM:', 40, startY);
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      let currentY = startY + 16;
      doc.text(billFrom.vendorName || 'Your Business Name', 40, currentY);
      currentY += 13;
      if (billFrom.vendorEmail) { doc.text(billFrom.vendorEmail, 40, currentY); currentY += 13; }
      for (const site of [billFrom.vendorWebsite, billFrom.vendorWebsite2].filter(Boolean)) {
        doc.text(displayUrl(site), 40, currentY); currentY += 13;
      }
      if (billFrom.vendorContact) { doc.text(billFrom.vendorContact, 40, currentY); currentY += 13; }
      if (billFrom.vendorAddress) { doc.text(billFrom.vendorAddress, 40, currentY); currentY += 13; }
      const cityStateZip = [billFrom.vendorCity, billFrom.vendorState, billFrom.vendorPin].filter(Boolean).join(', ');
      if (cityStateZip) { doc.text(cityStateZip, 40, currentY); currentY += 13; }
      if (billFrom.taxId) { doc.text(`Tax/GST ID: ${billFrom.taxId}`, 40, currentY); currentY += 13; }

      // Bill To Column
      doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold').text('BILLED TO:', 320, startY);
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      let clientY = startY + 16;
      doc.text(billTo.clientName || 'Client Name', 320, clientY);
      clientY += 13;
      if (billTo.clientEmail) { doc.text(billTo.clientEmail, 320, clientY); clientY += 13; }
      if (billTo.clientContact) { doc.text(billTo.clientContact, 320, clientY); clientY += 13; }
      if (billTo.clientAddress) { doc.text(billTo.clientAddress, 320, clientY); clientY += 13; }
      const clientCityStateZip = [billTo.clientCity, billTo.clientState, clientPinOrBlank(billTo.clientPin)].filter(Boolean).join(', ');
      if (clientCityStateZip) { doc.text(clientCityStateZip, 320, clientY); clientY += 13; }

      const tableTop = Math.max(currentY, clientY) + 25;

      // Table Header
      doc.rect(40, tableTop, 515, 24).fill('#F1F5F9');
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9);
      doc.text('DESCRIPTION', 50, tableTop + 7);
      doc.text('QTY', 310, tableTop + 7, { width: 50, align: 'center' });
      doc.text(`PRICE (${curr.code})`, 370, tableTop + 7, { width: 70, align: 'right' });
      doc.text(`AMOUNT (${curr.code})`, 450, tableTop + 7, { width: 95, align: 'right' });

      // Table Rows
      let itemY = tableTop + 28;
      doc.font('Helvetica').fontSize(9).fillColor('#334155');

      lineItems.forEach((item, index) => {
        const itemQty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || item.rate || 0);
        const itemAmount = Number(item.amount || (itemQty * itemPrice));

        // Row background striping
        if (index % 2 === 1) {
          doc.rect(40, itemY - 3, 515, 20).fill('#F8FAFC');
          doc.fillColor('#334155');
        }

        doc.text(item.name || item.description || `Item ${index + 1}`, 50, itemY, { width: 250 });
        doc.text(String(itemQty), 310, itemY, { width: 50, align: 'center' });
        doc.text(`${symbol}${itemPrice.toFixed(2)}`, 370, itemY, { width: 70, align: 'right' });
        doc.text(`${symbol}${itemAmount.toFixed(2)}`, 450, itemY, { width: 95, align: 'right' });

        itemY += 20;
      });

      // Divider line
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, itemY + 5).lineTo(555, itemY + 5).stroke();

      // Calculation totals
      let totalY = itemY + 16;
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      doc.text('Subtotal:', 360, totalY, { width: 90, align: 'right' });
      doc.text(`${symbol}${Number(subtotal).toFixed(2)}`, 455, totalY, { width: 90, align: 'right' });

      if (taxRate > 0 || taxAmount > 0) {
        totalY += 16;
        doc.text(`Tax (${taxRate}%):`, 360, totalY, { width: 90, align: 'right' });
        doc.text(`${symbol}${Number(taxAmount).toFixed(2)}`, 455, totalY, { width: 90, align: 'right' });
      }

      totalY += 18;
      doc.rect(350, totalY - 4, 205, 26).fill('#E2E8F0');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A');
      doc.text('Total Due:', 360, totalY + 3, { width: 90, align: 'right' });
      doc.text(`${symbol}${Number(total).toFixed(2)}`, 455, totalY + 3, { width: 90, align: 'right' });

      // Bank Details & Notes
      const notesY = itemY + 16;
      if (accountDetail.accountHolder || accountDetail.accountNumber || accountDetail.bankName) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text('Payment Information:', 40, notesY);
        doc.font('Helvetica').fontSize(8).fillColor('#64748B');
        let bankY = notesY + 14;
        if (accountDetail.bankName) { doc.text(`Bank: ${accountDetail.bankName}`, 40, bankY); bankY += 11; }
        if (accountDetail.accountHolder) { doc.text(`Account Name: ${accountDetail.accountHolder}`, 40, bankY); bankY += 11; }
        if (accountDetail.accountNumber) { doc.text(`Account #: ${accountDetail.accountNumber}`, 40, bankY); bankY += 11; }
        if (accountDetail.ifscCode) { doc.text(`IFSC/Routing: ${accountDetail.ifscCode}`, 40, bankY); bankY += 11; }
      }

      if (notes) {
        doc.moveDown();
        const bottomY = Math.max(totalY + 40, 680);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text('Notes / Terms:', 40, bottomY);
        doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(notes, 40, bottomY + 12, { width: 515 });
      }

      // -------------------------------------------------------------
      // Optional Particulars / Bill Summary (Always rendered on NEXT page)
      // -------------------------------------------------------------
      const validParticulars = Array.isArray(particulars) ? particulars.filter(p => p.description && p.description.trim() !== '') : [];

      if (validParticulars.length > 0) {
        doc.addPage();

        // Header for Particulars / Summary Page
        drawHeader('PARTICULARS / SUMMARY', 16, [`Invoice #: ${invoiceNumber}`, `Date: ${billDate}`]);

        // Meta info
        doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold').text(`Client: ${billTo.clientName || 'N/A'}`, 40, 110);
        doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Detailed scope of work, deliverables, and itemized particulars corresponding to the invoice.', 40, 126);

        // Particulars Table Header
        const partTableTop = 150;
        doc.rect(40, partTableTop, 515, 24).fill('#F1F5F9');
        doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9);
        doc.text('SR NO.', 45, partTableTop + 7, { width: 45, align: 'center' });
        doc.text('PARTICULARS / DESCRIPTION', 105, partTableTop + 7, { width: 320 });
        doc.text('DETAILS / REMARKS', 435, partTableTop + 7, { width: 110 });

        let partY = partTableTop + 28;
        doc.font('Helvetica').fontSize(9).fillColor('#334155');

        validParticulars.forEach((item, pIdx) => {
          if (pIdx % 2 === 1) {
            doc.rect(40, partY - 3, 515, 24).fill('#F8FAFC');
            doc.fillColor('#334155');
          }

          const sr = item.srNo || String(pIdx + 1);
          const desc = item.description || '';
          const remarks = item.remarks || item.details || '-';

          doc.text(String(sr), 45, partY, { width: 45, align: 'center' });
          doc.text(desc, 105, partY, { width: 320 });
          doc.text(remarks, 435, partY, { width: 110 });

          partY += 24;
        });

        // Bottom footer note
        doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, partY + 5).lineTo(555, partY + 5).stroke();
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94A3B8').text(
          'This Annexure forms an integral part of the primary invoice document.',
          40,
          partY + 16,
          { align: 'center', width: 515 }
        );
      }

      // Footer on every page: logo + business name, websites, page number.
      const { start, count } = doc.bufferedPageRange();
      for (let i = 0; i < count; i++) {
        doc.switchToPage(start + i);
        // Zero bottom margin so footer text near the page edge doesn't trigger an automatic new page.
        doc.page.margins.bottom = 0;
        const y = doc.page.height - 42;
        doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, y - 8).lineTo(555, y - 8).stroke();

        let nameX = 40;
        if (logoImg) {
          doc.image(logoImg, 40, y - 3, { fit: [60, 24], valign: 'center' });
          nameX = 108;
        }
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
          .text(billFrom.vendorName || '', nameX, y + 4, { width: 165 - (nameX - 40), height: 10, ellipsis: true });

        const sites = [billFrom.vendorWebsite, billFrom.vendorWebsite2].filter(Boolean).map(displayUrl).join('   |   ');
        doc.font('Helvetica').fontSize(8).fillColor(BRAND)
          .text(sites || billFrom.vendorEmail || '', 215, y + 4, { width: 235, height: 10, align: 'center', ellipsis: true });

        doc.fillColor('#94A3B8').text(`Page ${i + 1} of ${count}`, 455, y + 4, { width: 100, height: 10, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function clientPinOrBlank(pin) {
  return pin ? String(pin) : '';
}
