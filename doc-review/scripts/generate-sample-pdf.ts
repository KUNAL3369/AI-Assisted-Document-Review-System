import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function main() {
  const pdfDoc = await PDFDocument.create();

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const gray = rgb(0.4, 0.4, 0.4);
  const dark = rgb(0.15, 0.15, 0.15);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const accent = rgb(0.2, 0.4, 0.65);

  // ── Header bar ──
  page.drawRectangle({
    x: 0, y: height - 60, width, height: 60,
    color: accent,
  });
  page.drawText('INVOICE', {
    x: 50, y: height - 42, size: 26, font: helveticaBold, color: white,
  });
  page.drawText('INV-2024-001', {
    x: width - 170, y: height - 42, size: 16, font: helveticaBold, color: white,
  });

  // ── Vendor section ──
  page.drawText('Acme Corp', {
    x: 50, y: height - 100, size: 14, font: helveticaBold, color: dark,
  });
  const vendorLines = [
    '123 Business Ave, Suite 100',
    'New York, NY 10001',
    'contact@acmecorp.com',
    '(555) 123-4567',
  ];
  vendorLines.forEach((line, i) => {
    page.drawText(line, {
      x: 50, y: height - 118 - i * 16, size: 10, font: helvetica, color: gray,
    });
  });

  // ── Bill To section ──
  page.drawText('Bill To:', {
    x: 320, y: height - 100, size: 12, font: helveticaBold, color: dark,
  });
  const billToLines = [
    'Jane Smith',
    'TechStart Inc.',
    '456 Innovation Drive',
    'San Francisco, CA 94105',
  ];
  billToLines.forEach((line, i) => {
    page.drawText(line, {
      x: 320, y: height - 118 - i * 16, size: 10, font: helvetica, color: dark,
    });
  });

  // ── Invoice details ──
  const detailsY = height - 210;
  const details = [
    { label: 'Invoice Date:', value: 'January 15, 2024' },
    { label: 'Due Date:', value: 'February 14, 2024' },
    { label: 'PO Number:', value: 'PO-2024-0042' },
  ];
  details.forEach((d, i) => {
    page.drawText(d.label, {
      x: 50, y: detailsY - i * 18, size: 10, font: helveticaBold, color: dark,
    });
    page.drawText(d.value, {
      x: 150, y: detailsY - i * 18, size: 10, font: helvetica, color: dark,
    });
  });

  // ── Table header ──
  const tableTop = detailsY - 60;
  const colX = [50, 270, 370, 440, 510];
  const colWidths = [220, 100, 70, 70, 70];
  const headers = ['Description', 'Quantity', 'Unit Price', 'Total'];

  // table header background
  page.drawRectangle({
    x: 48, y: tableTop - 4, width: width - 96, height: 24,
    color: accent,
  });

  const hdrXs = [50, 328, 400, 475];
  headers.forEach((h, i) => {
    page.drawText(h, {
      x: hdrXs[i], y: tableTop + 2, size: 10, font: helveticaBold, color: white,
    });
  });

  // ── Table rows ──
  interface LineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }

  const lineItems: LineItem[] = [
    { description: 'Web Development — Frontend (React)', quantity: 40, unitPrice: 150, total: 6000 },
    { description: 'Backend API Development (Node.js)', quantity: 25, unitPrice: 175, total: 4375 },
    { description: 'Database Setup & Migration', quantity: 1, unitPrice: 2500, total: 2500 },
    { description: 'UI/UX Design Consultation', quantity: 10, unitPrice: 200, total: 2000 },
  ];

  let rowY = tableTop - 30;
  lineItems.forEach((item, i) => {
    const bgColor = i % 2 === 0 ? rgb(0.95, 0.95, 0.97) : white;
    page.drawRectangle({
      x: 48, y: rowY - 4, width: width - 96, height: 24,
      color: bgColor,
    });

    page.drawText(item.description, {
      x: 52, y: rowY + 2, size: 10, font: helvetica, color: dark,
    });
    page.drawText(String(item.quantity), {
      x: 330, y: rowY + 2, size: 10, font: helvetica, color: dark,
    });
    page.drawText(`$${item.unitPrice.toFixed(2)}`, {
      x: 400, y: rowY + 2, size: 10, font: helvetica, color: dark,
    });
    page.drawText(`$${item.total.toFixed(2)}`, {
      x: 475, y: rowY + 2, size: 10, font: helvetica, color: dark,
    });

    rowY -= 26;
  });

  // ── Summary section ──
  const summaryY = rowY - 16;
  const subtotal = 14875;
  const taxRate = 0.085;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // summary background
  page.drawRectangle({
    x: 370, y: summaryY - 4, width: 200, height: 76,
    color: rgb(0.95, 0.95, 0.97),
  });

  const summaryItems = [
    { label: 'Subtotal:', value: `$${subtotal.toFixed(2)}` },
    { label: `Tax (${(taxRate * 100).toFixed(1)}%):`, value: `$${taxAmount.toFixed(2)}` },
    { label: 'Total:', value: `$${total.toFixed(2)}`, bold: true },
  ];

  let sumY = summaryY + 18;
  summaryItems.forEach((item) => {
    page.drawText(item.label, {
      x: 375, y: sumY, size: item.bold ? 12 : 10, font: helveticaBold, color: dark,
    });
    page.drawText(item.value, {
      x: 500, y: sumY, size: item.bold ? 12 : 10,
      font: item.bold ? helveticaBold : helvetica, color: dark,
    });
    sumY -= item.bold ? 22 : 20;
  });

  // ── Footer ──
  page.drawLine({
    start: { x: 50, y: 60 }, end: { x: width - 50, y: 60 },
    thickness: 1, color: gray,
  });
  page.drawText('Thank you for your business!', {
    x: 50, y: 36, size: 12, font: helveticaBold, color: accent,
  });
  page.drawText('Acme Corp | 123 Business Ave, Suite 100, New York, NY 10001 | (555) 123-4567', {
    x: 50, y: 18, size: 8, font: helvetica, color: gray,
  });

  const pdfBytes = await pdfDoc.save();

  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.resolve(__dirname, '..', 'sample-invoice.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`PDF generated: ${outPath}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
