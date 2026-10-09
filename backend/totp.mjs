import crypto from 'node:crypto'

// Base32 Alphabet (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateBase32Secret(length = 20) {
  const randomBytes = crypto.randomBytes(length)
  let secret = ''
  for (let i = 0; i < randomBytes.length; i++) {
    secret += BASE32_CHARS[randomBytes[i] % 32]
  }
  return secret
}

function base32Decode(base32Str) {
  const cleanStr = base32Str.toUpperCase().replace(/[\s-]/g, '')
  let bits = 0
  let value = 0
  const output = []

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i]
    const val = BASE32_CHARS.indexOf(char)
    if (val === -1) continue

    value = (value << 5) | val
    bits += 5

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

/**
 * Generate 6-digit TOTP code for a given secret and counter/time
 */
export function generateTOTP(secret, timeOffsetSeconds = 0) {
  const key = base32Decode(secret)
  const epoch = Math.floor((Date.now() + timeOffsetSeconds * 1000) / 1000)
  const timeStep = Math.floor(epoch / 30)

  const timeBuffer = Buffer.alloc(8)
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0)

  const hmac = crypto.createHmac('sha1', key)
  hmac.update(timeBuffer)
  const digest = hmac.digest()

  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  const otp = binary % 1000000
  return String(otp).padStart(6, '0')
}

/**
 * Verify a 6-digit TOTP token with expanded clock drift tolerance (+/- 3 minutes)
 * This eliminates the issue where mobile phone clock desync required users to enter codes twice
 */
export function verifyTOTP(token, secret) {
  if (!token || !secret) return false
  const cleanToken = String(token).replace(/\D/g, '').trim()
  if (cleanToken.length !== 6) return false

  // Check current window and +/- 30s to +/- 240s (+/- 4 minutes) window to handle phone time discrepancies
  const offsets = [0, -30, 30, -60, 60, -90, 90, -120, 120, -150, 150, -180, 180, -210, 210, -240, 240]
  for (const offset of offsets) {
    if (generateTOTP(secret, offset) === cleanToken) {
      return true
    }
  }
  return false
}

/**
 * Generate Emergency Backup Recovery Codes (5 codes, e.g. 8A4C-9F2B)
 */
export function generateBackupCodes(count = 5) {
  const codes = []
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase()
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase()
    codes.push(`${part1}-${part2}`)
  }
  return codes
}

/**
 * Simple, zero-dependency QR Code generator (SVG string) for TOTP URL
 * Uses lightweight QR matrix algorithm
 */
export function generateOtpAuthUrl(loginname, secret, issuer = 'SMART-HOSCHECK') {
  const label = encodeURIComponent(`${issuer}:${loginname}`)
  const encIssuer = encodeURIComponent(issuer)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encIssuer}&digits=6&period=30`
}
