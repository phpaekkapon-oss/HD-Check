import { useState, useRef, type ChangeEvent, type FC } from 'react'
import {
  X,
  Camera,
  Upload,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  User as UserIcon,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

interface ProfileAvatarModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

export const ProfileAvatarModal: FC<ProfileAvatarModalProps> = ({ isOpen, onClose }) => {
  const { user, uploadAvatar, deleteAvatar } = useAuth()
  const { accent } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const currentAvatar = previewUrl || user?.avatar_url || null

  /**
   * Resize and crop image to a square 512x512 JPEG for optimal quality & database efficiency
   */
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const size = 512
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas context error'))

          // Center crop to square
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          const base64 = canvas.toDataURL('image/jpeg', 0.9)
          resolve(base64)
        }
        img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการโหลดไฟล์'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPEG, PNG, WebP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('ขนาดไฟล์ใหญ่เกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลง')
      return
    }

    setError(null)
    setSuccessMsg(null)
    setIsProcessing(true)

    try {
      const base64 = await processImageFile(file)
      setPreviewUrl(base64)
      setSelectedBase64(base64)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!selectedBase64) return
    setIsProcessing(true)
    setError(null)
    setSuccessMsg(null)

    const res = await uploadAvatar(selectedBase64, 'image/jpeg')
    setIsProcessing(false)

    if (!res.success) {
      setError(res.error || 'บันทึกรูปโปรไฟล์ไม่สำเร็จ')
    } else {
      setSuccessMsg('บันทึกรูปโปรไฟล์ลงฐานข้อมูลเรียบร้อยแล้ว')
      setSelectedBase64(null)
      setTimeout(() => {
        onClose()
      }, 1000)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('คุณต้องการลบรูปโปรไฟล์นี้และกลับไปใช้ไอคอนเริ่มต้นใช่หรือไม่?')) return
    setIsProcessing(true)
    setError(null)
    setSuccessMsg(null)

    const res = await deleteAvatar()
    setIsProcessing(false)

    if (!res.success) {
      setError(res.error || 'ลบรูปไม่สำเร็จ')
    } else {
      setPreviewUrl(null)
      setSelectedBase64(null)
      setSuccessMsg('ลบรูปโปรไฟล์เรียบร้อยแล้ว')
      setTimeout(() => {
        onClose()
      }, 800)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isProcessing) onClose()
        }}
      />

      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#0f1322] border border-slate-200 dark:border-white/15 shadow-2xl p-6 text-slate-800 dark:text-white z-10 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="grid place-items-center size-9 rounded-2xl text-white shadow-md"
              style={{
                background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
              }}
            >
              <Camera className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                รูปโปรไฟล์ผู้ใช้งาน
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user?.name} (@{user?.loginname})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="size-4 shrink-0 text-rose-500" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="size-4 shrink-0 text-emerald-500" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* Avatar Preview Display */}
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="relative group">
            <div
              className="size-36 sm:size-40 rounded-full border-4 shadow-xl overflow-hidden grid place-items-center bg-slate-100 dark:bg-white/5 transition-transform group-hover:scale-102"
              style={{
                borderColor: accent.hex,
                boxShadow: `0 8px 32px ${accent.glow}`,
              }}
            >
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt={user?.name || 'Profile'}
                  className="size-full object-cover"
                />
              ) : (
                <UserIcon className="size-20 text-slate-400 dark:text-slate-500" />
              )}
            </div>

            {/* Quick Upload Hover Overlay Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              title="คลิกเพื่อเลือกไฟล์รูปภาพ"
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1 cursor-pointer backdrop-blur-2xs"
            >
              <Camera className="size-6" />
              <span>เลือกรูปภาพ</span>
            </button>
          </div>

          <div className="mt-3 text-center">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {user?.name}
            </div>
            <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
              {user?.position || user?.entryposition || 'เจ้าหน้าที่ HOSxP'}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
              จัดเก็บเป็น Binary BLOB ในฐานข้อมูล MySQL
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Actions Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Upload className="size-4" />
              <span>{currentAvatar ? 'เลือกรูปใหม่…' : 'อัปโหลดรูปภาพ…'}</span>
            </button>

            {user?.avatar_url && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isProcessing}
                className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="ลบรูปโปรไฟล์"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">ลบรูป</span>
              </button>
            )}
          </div>

          {selectedBase64 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-98 animate-fade-in"
              style={{
                background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
                boxShadow: `0 4px 20px ${accent.glow}`,
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>กำลังบันทึกลงฐานข้อมูล…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>บันทึกรูปโปรไฟล์</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            ยกเลิก / ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
