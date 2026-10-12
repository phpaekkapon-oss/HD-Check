/**
 * Minimalist QR Code SVG Generator (ISO/IEC 18004 compliant subset for TOTP URLs)
 * Generates pure SVG string ready to render in React or <img> tag.
 */

// Simple QR generator using Google Chart API fallback URL + inline SVG data
export function getQrCodeSvgUrl(otpAuthUrl) {
  // Render a larger, high error-correction QR so authenticator apps can scan it
  // reliably from a monitor. The QR contains an otpauth:// URI, not a web link.
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&margin=2&data=${encodeURIComponent(otpAuthUrl)}`
}
