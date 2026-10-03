import PDFDocument from 'pdfkit';
import { getCurrencyDetails } from './billCalculationService.js';

/**
 * Generate PDF buffer from invoice data.
 * Pure in-memory streaming, perfectly suited for AWS Lambda memory execution without native browser dependencies.
 */
export async function createInvoicePdfBuffer(billData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
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

      // Header Banner
      doc.rect(0, 0, doc.page.width, 100).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('INVOICE', 40, 36);
      doc.fontSize(10).font('Helvetica').text(`Invoice #: ${invoiceNumber}`, 400, 36, { align: 'right' });
      doc.text(`Date: ${billDate}`, 400, 52, { align: 'right' });
      if (dueDate) {
        doc.text(`Due: ${dueDate}`, 400, 68, { align: 'right' });
      }

      doc.moveDown(4);

      // Section: Bill From and Bill To
      const startY = 120;
      doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold').text('BILLED FROM:', 40, startY);
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      let currentY = startY + 16;
      doc.text(billFrom.vendorName || 'Your Business Name', 40, currentY);
      currentY += 13;
      if (billFrom.vendorEmail) { doc.text(billFrom.vendorEmail, 40, currentY); currentY += 13; }
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
        doc.rect(0, 0, doc.page.width, 90).fill('#1E293B');
        doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('PARTICULARS / BILL SUMMARY', 40, 32);
        doc.fontSize(10).font('Helvetica').text(`Invoice #: ${invoiceNumber}`, 400, 32, { align: 'right' });
        doc.text(`Date: ${billDate}`, 400, 48, { align: 'right' });
        doc.text(`Page 2 of 2`, 400, 64, { align: 'right' });

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

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function clientPinOrBlank(pin) {
  return pin ? String(pin) : '';
}
