/**
 * receiptService.js
 *
 * Generates receipt PDFs using pdfkit, sized for 80mm thermal printers (226pt wide).
 * PDFs are saved to disk and the path stored in the sales table.
 * Served as a stream so the client can cache them in IndexedDB for offline reprints.
 */

import PDFDocument from 'pdfkit';
import fs          from 'fs';
import path        from 'path';
import { env }     from '../config/env.js';

// 80mm thermal roll ≈ 226pt wide, height is dynamic
const PAGE_WIDTH   = 226;
const MARGIN       = 12;
const CONTENT_W    = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT  = 11;

// ─── Build receipt PDF and save to disk ───────────────────────────────────────
/**
 * @param {object} sale     - full sale row with items array
 * @param {object} business - { name, address, tel, vat }
 * @returns {string}        - absolute path to saved PDF
 */
export async function generateReceiptPDF(sale, business) {
  const storageDir = path.resolve(env.RECEIPT_STORAGE_PATH);
  fs.mkdirSync(storageDir, { recursive: true });

  const filename = `${sale.id}.pdf`;
  const filepath = path.join(storageDir, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    [PAGE_WIDTH, 600],   // height is a rough max; pdfkit clips to content
      margin:  MARGIN,
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error',  reject);

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(business.name, MARGIN, MARGIN, { width: CONTENT_W, align: 'center' });

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .text(business.address, { width: CONTENT_W, align: 'center' })
      .text(business.tel,     { width: CONTENT_W, align: 'center' });

    if (business.vat) {
      doc.text(`VAT No: ${business.vat}`, { width: CONTENT_W, align: 'center' });
    }

    doc.moveDown(0.4);
    divider(doc);
    doc.moveDown(0.3);

    // ── Receipt metadata ────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(7.5);

    row2(doc, 'Invoice:',  sale.id);
    row2(doc, 'Date:',     `${sale.sale_date}`);
    row2(doc, 'Time:',     `${sale.sale_time || ''}`);
    if (sale.table_no)   row2(doc, 'Table:',    sale.table_no);
    if (sale.customer)   row2(doc, 'Customer:', sale.customer);
    if (sale.cashier_name) row2(doc, 'Cashier:', sale.cashier_name);
    if (sale.waiter_name)  row2(doc, 'Waiter:',  sale.waiter_name);

    doc.moveDown(0.3);
    divider(doc);
    doc.moveDown(0.3);

    // ── Column headers ──────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(7.5);
    itemRow(doc, 'ITEM', 'QTY', 'PRICE', 'TOTAL');
    doc.moveDown(0.15);
    divider(doc, '·');
    doc.moveDown(0.15);

    // ── Line items ──────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(7.5);

    for (const item of sale.items || []) {
      const lineTotal = item.unit_price * item.qty;
      itemRow(
        doc,
        truncate(item.name, 18),
        String(item.qty),
        fmt(item.unit_price),
        fmt(lineTotal)
      );
    }

    doc.moveDown(0.3);
    divider(doc);
    doc.moveDown(0.3);

    // ── Totals ──────────────────────────────────────────────────────────────
    if (sale.discount_amt && sale.discount_amt > 0) {
      doc.font('Helvetica').fontSize(7.5);
      row2(doc, 'Subtotal:', fmt(sale.subtotal));
      row2(doc, `Discount (${sale.discount_pct}%):`, `-${fmt(sale.discount_amt)}`);
    }

    doc.font('Helvetica-Bold').fontSize(9);
    row2(doc, 'TOTAL:', fmt(sale.total));

    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(7.5);
    row2(doc, 'Payment:', (sale.payment || '').toUpperCase());

    if (sale.payment_ref) {
      row2(doc, 'Ref:', sale.payment_ref);
    }

    if (sale.payment === 'cash' && sale.change_due && sale.change_due > 0) {
      row2(doc, 'Tendered:', fmt(sale.tendered));
      row2(doc, 'Change:',   fmt(sale.change_due));
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    divider(doc);
    doc.moveDown(0.4);

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Thank you for dining with us!', MARGIN, doc.y, {
        width: CONTENT_W,
        align: 'center',
      });

    doc
      .font('Helvetica')
      .fontSize(7)
      .text('Please come again', { width: CONTENT_W, align: 'center' });

    doc.moveDown(0.5);

    // VAT summary if applicable
    if (business.vat && sale.total > 0) {
      const vatRate  = 0.16;   // Kenya standard VAT 16%
      const vatAmt   = sale.total - sale.total / (1 + vatRate);
      const exclVat  = sale.total - vatAmt;
      doc.font('Helvetica').fontSize(7);
      divider(doc, '·');
      doc.moveDown(0.2);
      row2(doc, 'Excl. VAT:', fmt(exclVat));
      row2(doc, 'VAT (16%):',  fmt(vatAmt));
      row2(doc, 'Incl. VAT:', fmt(sale.total));
    }

    doc.moveDown(0.8);
    doc.end();
  });

  return filepath;
}

/**
 * Stream an existing receipt PDF to the response.
 * Falls back to regenerating if file was deleted.
 */
export function streamReceiptPDF(filepath, res) {
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: 'Receipt not found' });
    return;
  }

  res.setHeader('Content-Type',        'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(filepath)}"`);
  res.setHeader('Cache-Control',       'public, max-age=31536000, immutable');

  fs.createReadStream(filepath).pipe(res);
}

// ─── ESC/POS raw print data ───────────────────────────────────────────────────
/**
 * Generates ESC/POS byte commands for direct thermal printer printing.
 * Used when the browser has WebUSB/Serial access to the printer.
 * Returns a Buffer of ESC/POS commands.
 */
export function generateEscPos(sale, business) {
  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;
  const CR  = 0x0D;

  const cmds = [];

  const push = (...bytes) => cmds.push(...bytes);
  const text = (str) => { for (const c of str) push(c.charCodeAt(0)); };
  const nl   = ()      => push(LF);
  const line = (ch = '-', len = 32) => { text(ch.repeat(len)); nl(); };

  // Initialize printer
  push(ESC, 0x40);           // ESC @ — reset

  // Center align
  push(ESC, 0x61, 0x01);

  // Bold + double height for business name
  push(ESC, 0x45, 0x01);    // bold on
  push(GS,  0x21, 0x11);    // double width + height
  text(business.name.slice(0, 16)); nl();
  push(GS,  0x21, 0x00);    // normal size
  push(ESC, 0x45, 0x00);    // bold off

  text(business.address.slice(0, 32)); nl();
  if (business.tel) { text(business.tel); nl(); }
  nl();

  // Left align
  push(ESC, 0x61, 0x00);

  line();
  text(`Invoice: ${sale.id}`); nl();
  text(`Date:    ${sale.sale_date}`); nl();
  text(`Time:    ${sale.sale_time || ''}`); nl();
  if (sale.table_no)    { text(`Table:   ${sale.table_no}`);     nl(); }
  if (sale.cashier_name){ text(`Cashier: ${sale.cashier_name}`); nl(); }
  line();

  // Items
  for (const item of sale.items || []) {
    const name   = truncate(item.name, 20).padEnd(20);
    const qty    = String(item.qty).padStart(3);
    const price  = fmt(item.unit_price).padStart(9);
    text(`${name}${qty}${price}`); nl();
  }

  line();

  // Total
  push(ESC, 0x45, 0x01);    // bold
  const totalLabel = 'TOTAL:';
  const totalVal   = fmt(sale.total).padStart(32 - totalLabel.length);
  text(totalLabel + totalVal); nl();
  push(ESC, 0x45, 0x00);    // bold off

  text(`Payment: ${(sale.payment || '').toUpperCase()}`); nl();
  if (sale.payment_ref) { text(`Ref: ${sale.payment_ref}`); nl(); }

  nl();

  // Center + footer
  push(ESC, 0x61, 0x01);
  text('Thank you for dining with us!'); nl();
  nl(); nl(); nl();

  // Cut paper (full cut)
  push(GS, 0x56, 0x00);

  return Buffer.from(cmds);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function fmt(n) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function truncate(str, len) {
  return str?.length > len ? str.slice(0, len - 1) + '…' : (str || '');
}

function divider(doc, ch = '-') {
  doc.font('Helvetica').fontSize(7.5)
     .text(ch.repeat(38), MARGIN, doc.y, { width: CONTENT_W });
}

function row2(doc, label, value) {
  const y = doc.y;
  doc.text(label, MARGIN, y, { width: CONTENT_W * 0.55, continued: false });
  doc.text(value, MARGIN + CONTENT_W * 0.55, y, { width: CONTENT_W * 0.45, align: 'right' });
}

function itemRow(doc, name, qty, price, total) {
  const y  = doc.y;
  const c1 = CONTENT_W * 0.42;
  const c2 = CONTENT_W * 0.10;
  const c3 = CONTENT_W * 0.23;
  const c4 = CONTENT_W * 0.25;

  doc.text(name,  MARGIN,               y, { width: c1 });
  doc.text(qty,   MARGIN + c1,          y, { width: c2, align: 'right' });
  doc.text(price, MARGIN + c1 + c2,     y, { width: c3, align: 'right' });
  doc.text(total, MARGIN + c1+c2+c3,    y, { width: c4, align: 'right' });
  doc.moveDown(0.25);
}

// ─── Z-Report PDF for shift close ─────────────────────────────────────────────
export async function generateZReportPDF({ shift, summary, business }) {
  const storageDir = path.resolve(env.RECEIPT_STORAGE_PATH || './receipts');
  fs.mkdirSync(storageDir, { recursive: true });

  const filename = `zreport-${shift.shift_ref || shift.id}-${Date.now()}.pdf`;
  const filepath = path.join(storageDir, filename);

  const TAX    = parseFloat(env.TAX_RATE || '0.16');
  const SVC    = parseFloat(env.SVC_RATE || '0.02');
  const total  = parseFloat(summary?.total_sales || 0);
  const taxAmt = Math.round(total / (1 + TAX + SVC) * TAX);
  const svcAmt = Math.round(total / (1 + TAX + SVC) * SVC);
  const net    = total - taxAmt - svcAmt;
  const exp    = parseFloat(summary?.expected_cash || 0);
  const closing = parseFloat(shift.closing_cash || 0);
  const variance = closing - exp;
  const pay = { cash:0, mpesa:0, split:0 };
  (summary?.payment_breakdown || []).forEach(b => {
    pay[b.payment] = (pay[b.payment] || 0) + parseFloat(b.amount || 0);
  });

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size:[226,800], margin:MARGIN, autoFirstPage:true });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error',  reject);

    const W = CONTENT_W;
    const dash = () => doc.font('Helvetica').fontSize(7).text('-'.repeat(36), { width:W, align:'center' });
    const row  = (label, val, bold=false) => {
      doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(8);
      const y = doc.y;
      doc.text(label, MARGIN, y, { width:W*0.6 });
      doc.text(val,   MARGIN+W*0.6, y, { width:W*0.4, align:'right' });
    };

    doc.font('Helvetica-Bold').fontSize(11).text(business.name||'Damascus Hotel', MARGIN, MARGIN, { width:W, align:'center' });
    doc.font('Helvetica').fontSize(7.5)
       .text(business.address||'', { width:W, align:'center' })
       .text(business.tel||'',     { width:W, align:'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text('Z - REPORT', { width:W, align:'center' });
    doc.font('Helvetica').fontSize(7.5)
       .text(`Shift: ${shift.shift_ref||shift.id}`, { width:W, align:'center' })
       .text(`Date: ${new Date(shift.opened_at).toLocaleDateString('en-KE')}`, { width:W, align:'center' })
       .text(`Cashier: ${shift.opened_by_name||''}`, { width:W, align:'center' })
       .text(`Open: ${new Date(shift.opened_at).toTimeString().slice(0,5)}  Close: ${new Date(shift.closed_at).toTimeString().slice(0,5)}`, { width:W, align:'center' });

    doc.moveDown(0.5); dash();
    doc.font('Helvetica-Bold').fontSize(8).text('SALES SUMMARY', { width:W, align:'center' });
    dash();
    row('Gross Revenue', `KES ${total.toLocaleString()}`, true);
    row('Net Sales',     `KES ${net.toLocaleString()}`);
    row(`VAT (${Math.round(TAX*100)}%)`,  `KES ${taxAmt.toLocaleString()}`);
    row(`Service (${Math.round(SVC*100)}%)`, `KES ${svcAmt.toLocaleString()}`);
    row('Transactions',  String(summary?.total_covers||0));

    doc.moveDown(0.5); dash();
    doc.font('Helvetica-Bold').fontSize(8).text('PAYMENT METHODS', { width:W, align:'center' });
    dash();
    row('Cash',   `KES ${(pay.cash||0).toLocaleString()}`);
    row('M-Pesa', `KES ${(pay.mpesa||0).toLocaleString()}`);
    row('Split',  `KES ${(pay.split||0).toLocaleString()}`);

    doc.moveDown(0.5); dash();
    doc.font('Helvetica-Bold').fontSize(8).text('CASH RECONCILIATION', { width:W, align:'center' });
    dash();
    row('Opening Float', `KES ${parseFloat(shift.opening_float||0).toLocaleString()}`);
    row('Cash Sales',    `KES ${(pay.cash||0).toLocaleString()}`);
    row('Expected Cash', `KES ${exp.toLocaleString()}`, true);
    row('Actual Cash',   `KES ${closing.toLocaleString()}`, true);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9)
       .text(variance===0?'BALANCED':variance>0?`OVER: KES ${variance.toLocaleString()}`:`SHORT: KES ${Math.abs(variance).toLocaleString()}`, { width:W, align:'center' });

    doc.moveDown(0.5); dash();
    doc.font('Helvetica').fontSize(7)
       .text(`Printed: ${new Date().toLocaleString('en-KE')}`, { width:W, align:'center' })
       .text('Damascus Hotel POS', { width:W, align:'center' });
    doc.end();
  });

  return filepath;
}
