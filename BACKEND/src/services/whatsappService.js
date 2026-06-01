/**
 * whatsappService.js
 * Sends WhatsApp messages via Meta WhatsApp Business Cloud API.
 */

import fs   from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const BASE_URL = 'https://graph.facebook.com/v19.0';

export async function sendWhatsAppText(to, message) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    console.warn('⚠️  WhatsApp not configured — skipping');
    return null;
  }
  const { default: axios } = await import('axios');
  const res = await axios.post(
    `${BASE_URL}/${env.WHATSAPP_PHONE_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
    { headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

export async function sendWhatsAppPDF(to, pdfPath, caption = '') {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    console.warn('⚠️  WhatsApp not configured — skipping PDF send');
    return null;
  }
  const { default: axios } = await import('axios');
  const { default: FormData } = await import('form-data');

  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath), { filename: path.basename(pdfPath), contentType: 'application/pdf' });
  form.append('type', 'application/pdf');
  form.append('messaging_product', 'whatsapp');

  const uploadRes = await axios.post(
    `${BASE_URL}/${env.WHATSAPP_PHONE_ID}/media`,
    form,
    { headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, ...form.getHeaders() } }
  );

  const mediaId = uploadRes.data?.id;
  if (!mediaId) throw new Error('Failed to upload PDF to WhatsApp media');

  const res = await axios.post(
    `${BASE_URL}/${env.WHATSAPP_PHONE_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'document', document: { id: mediaId, caption, filename: path.basename(pdfPath) } },
    { headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}
