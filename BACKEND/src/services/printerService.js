/**
 * printerService.js
 *
 * Sends ESC/POS data directly to a network thermal printer via TCP socket.
 * Tested with Xprinter XP-58 on port 9100.
 */

import net from 'net';

const PRINTER_IP   = process.env.PRINTER_IP   || '192.168.1.120';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const TIMEOUT_MS   = 5000;

/**
 * Send a Buffer of ESC/POS bytes to the printer over TCP.
 * @param {Buffer} data
 * @returns {Promise<void>}
 */
export function printRaw(data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(TIMEOUT_MS);

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(data, () => {
        socket.destroy();
        resolve();
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Printer timeout — is ${PRINTER_IP}:${PRINTER_PORT} reachable?`));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`Printer error: ${err.message}`));
    });
  });
}

/**
 * Build ESC/POS bytes for a pre-bill (waiter receipt for customer).
 * Works with 58mm paper (32 chars per line).
 */
export function buildPrebillEscPos({ hold, items, person, business, TAX, SVC }) {
  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;
  const buf = [];

  const push = (...bytes) => bytes.forEach(b =>
    buf.push(typeof b === 'string' ? b.charCodeAt(0) : b)
  );
  const text = (str) => [...str].forEach(ch => push(ch));
  const line = (str = '') => { text(str); push(LF); };
  const dashes = () => line('--------------------------------');
  const center = (str, width = 32) => {
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  };
  const cols = (left, right, width = 32) => {
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  };

  const fmt = n => 'KES ' + Number(n).toFixed(2);

  // Reset
  push(ESC, 0x40);

  // Header — center + bold
  push(ESC, 0x61, 0x01);           // center
  push(ESC, 0x45, 0x01);           // bold
  push(ESC, 0x21, 0x10);           // double height
  line(business.name || 'Damascus Hotel');
  push(ESC, 0x21, 0x00);           // normal size
  push(ESC, 0x45, 0x00);           // bold off
  if (business.address) line(business.address);
  if (business.tel)     line('Tel: ' + business.tel);
  push(ESC, 0x61, 0x00);           // left

  dashes();

  // Bill info
  push(ESC, 0x45, 0x01);
  line(center('PRE-BILL'));
  push(ESC, 0x45, 0x00);
  line('Table : ' + (hold.table_no || hold.table || 'Walk-in'));
  if (person) line('Person: ' + person);
  line('Date  : ' + new Date().toLocaleString('en-KE'));
  line('Waiter: ' + (hold.waiter_name || hold.waiter || 'Staff'));

  dashes();

  // Column headers
  push(ESC, 0x45, 0x01);
  line(cols('Item', 'Amount'));
  push(ESC, 0x45, 0x00);
  dashes();

  // Items
  const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
  items.forEach(item => {
    const note = (item.note || '').replace(/^\[[^\]]+\]\s*/g, '').replace('[EXTRA]','').trim();
    const nameQty = `${item.qty}x ${item.name}`;
    const amount  = fmt(item.price * item.qty);
    // Wrap long names
    if (nameQty.length + amount.length + 1 <= 32) {
      line(cols(nameQty, amount));
    } else {
      line(nameQty);
      line(cols('', amount));
    }
    if (note) line('  * ' + note);
  });

  dashes();

  // Totals
  const tax   = sub * TAX;
  const svc   = sub * SVC;
  const total = sub + tax + svc;

  line(cols('Subtotal', fmt(sub)));
  line(cols(`Tax (${Math.round(TAX*100)}%)`, fmt(tax)));
  line(cols(`Service (${Math.round(SVC*100)}%)`, fmt(svc)));
  dashes();

  push(ESC, 0x45, 0x01);
  push(ESC, 0x21, 0x10);           // double height
  line(cols('TOTAL', fmt(total)));
  push(ESC, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  dashes();

  // Footer
  push(ESC, 0x61, 0x01);           // center
  line('Thank you for dining with us!');
  line('Please pay at the cashier.');
  push(ESC, 0x61, 0x00);

  // Feed and cut
  push(LF, LF, LF, LF);
  push(GS, 0x56, 0x41, 0x03);     // partial cut

  return Buffer.from(buf);
}
