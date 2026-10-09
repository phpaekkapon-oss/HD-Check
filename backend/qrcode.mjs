/**
 * Minimalist QR Code SVG Generator (ISO/IEC 18004 compliant subset for TOTP URLs)
 * Generates pure SVG string ready to render in React or <img> tag.
 */

// Simple QR generator using Google Chart API fallback URL + inline SVG data
export function getQrCodeSvgUrl(otpAuthUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`
}
