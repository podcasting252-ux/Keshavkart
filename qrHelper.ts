import QRCode from 'qrcode';
import { ShopInfo } from '../types';

/**
 * Builds the unique, permanent shop URL that opens THIS SHOP directly.
 * Works accurately in development preview, shared URL, and production Cloud Run deployment.
 */
export function getShopUrl(shop: ShopInfo): string {
  if (typeof window === 'undefined') {
    return `https://apnamart.app/?shop=${encodeURIComponent(shop.id)}`;
  }
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const url = new URL(pathname, origin);
  url.searchParams.set('shop', shop.id);
  if (shop.qrVersion > 1) {
    url.searchParams.set('v', String(shop.qrVersion));
  }
  return url.toString();
}

/**
 * Generates high-resolution, crisp QR code data URL.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 720,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    throw err;
  }
}

/**
 * Generates an SVG string representation of the QR code.
 */
export async function generateQRCodeSvg(text: string): Promise<string> {
  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return svg;
  } catch (err) {
    console.error('Failed to generate SVG QR Code:', err);
    throw err;
  }
}

/**
 * Creates a beautifully styled composite standee card PNG image and downloads it.
 * Contains: Shop Name, QR Code, Bilingual Scan Instruction, Contact Details.
 */
export async function downloadStyledShopQRCode(shop: ShopInfo, qrDataUrl: string): Promise<void> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cardWidth = 900;
  const cardHeight = 1200;
  canvas.width = cardWidth;
  canvas.height = cardHeight;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Outer Border & Header band
  ctx.fillStyle = '#166534'; // Emerald green theme
  ctx.fillRect(0, 0, cardWidth, 180);

  // Decorative sub-strip
  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 180, cardWidth, 8);

  // Shop Header text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(shop.name, cardWidth / 2, 85);

  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#bbf7d0';
  ctx.fillText(shop.tagline || 'Single-Shop Direct Ordering', cardWidth / 2, 130);

  // Card sub-header badge
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.roundRect(80, 220, cardWidth - 160, 60, 12);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 24px sans-serif';
  ctx.fillText('OFFICIAL STORE QR CODE', cardWidth / 2, 258);

  // QR Code Box
  const qrBoxSize = 540;
  const qrBoxX = (cardWidth - qrBoxSize) / 2;
  const qrBoxY = 320;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(qrBoxX - 20, qrBoxY - 20, qrBoxSize + 40, qrBoxSize + 40, 24);
  ctx.stroke();

  // Load QR Image onto canvas
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
      resolve();
    };
    img.src = qrDataUrl;
  });

  // Short instruction below it (as requested):
  // "Scan this QR code to open our shop"
  // Hindi: "हमारी दुकान खोलने के लिए QR कोड स्कैन करें"
  const textStartY = qrBoxY + qrBoxSize + 65;

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('Scan this QR code to open our shop', cardWidth / 2, textStartY);

  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('हमारी दुकान खोलने के लिए QR कोड स्कैन करें', cardWidth / 2, textStartY + 45);

  // Sub-badges
  ctx.fillStyle = '#64748b';
  ctx.font = '20px sans-serif';
  ctx.fillText('Instant Mobile Ordering • Fresh Delivery • Direct Shop Pricing', cardWidth / 2, textStartY + 95);

  // Footer footer band
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, cardHeight - 110, cardWidth, 110);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cardHeight - 110);
  ctx.lineTo(cardWidth, cardHeight - 110);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Shop Address: ${shop.address}`, cardWidth / 2, cardHeight - 65);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`Helpline: ${shop.phone} | Shop ID: ${shop.id}`, cardWidth / 2, cardHeight - 35);

  // Trigger Download
  const link = document.createElement('a');
  link.download = `${shop.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-shop-qr.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads raw QR code PNG
 */
export function downloadRawQRCode(qrDataUrl: string, shopName: string): void {
  const link = document.createElement('a');
  link.download = `${shopName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-qr-only.png`;
  link.href = qrDataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copies shop link or uses navigator.share
 */
export async function shareShopQRCode(shop: ShopInfo, shopUrl: string): Promise<{ shared: boolean; message: string }> {
  const shareData = {
    title: shop.name,
    text: `Scan our Shop QR or click this link to open ${shop.name} directly!\nहमारी दुकान खोलने के लिए QR कोड स्कैन करें:\n`,
    url: shopUrl,
  };

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return { shared: true, message: 'Shop QR shared successfully!' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { shared: false, message: 'Share cancelled' };
      }
    }
  }

  // Fallback: Copy to clipboard
  try {
    await navigator.clipboard.writeText(shopUrl);
    return { shared: true, message: 'Shop link copied to clipboard! Share it with your customers.' };
  } catch {
    return { shared: false, message: 'Unable to copy link automatically. Please copy the URL manually.' };
  }
}
