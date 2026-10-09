import { useState, useRef, useEffect, type ChangeEvent, type FC } from 'react'
import {
  X,
  Camera,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface ProfileAvatarModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly initialFile?: File | null
}

const VIEWPORT_SIZE = 320
const CROP_DIAMETER = 260
const CROP_RADIUS = CROP_DIAMETER / 2
const VIEWPORT_CENTER = VIEWPORT_SIZE / 2

export const ProfileAvatarModal: FC<ProfileAvatarModalProps> = ({
  isOpen,
  onClose,
  initialFile,
}) => {
  const { user, uploadAvatar, deleteAvatar } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [imageSource, setImageSource] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })

  // Load initial file or existing avatar
  useEffect(() => {
    if (!isOpen) return

    if (initialFile) {
      loadFile(initialFile)
    } else if (user?.avatar_url) {
      setImageSource(user.avatar_url)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } else {
      setImageSource(null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    setError(null)
    setSuccessMsg(null)
  }, [isOpen, initialFile, user?.avatar_url])

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPEG, PNG, WebP)')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('ขนาดไฟล์ใหญ่เกิน 15 MB กรุณาเลือกไฟล์ที่เล็กลง')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImageSource(dataUrl)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setError(null)
    }
    reader.onerror = () => {
      setError('ไม่สามารถอ่านไฟล์รูปภาพได้')
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadFile(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Handle image natural size loaded
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNaturalSize({
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    })
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Calculate rendered size so the image always at least covers the crop circle
  const baseScale =
    naturalSize.width > 0 && naturalSize.height > 0
      ? CROP_DIAMETER / Math.min(naturalSize.width, naturalSize.height)
      : 1

  const renderedWidth = naturalSize.width ? naturalSize.width * baseScale * zoom : 0
  const renderedHeight = naturalSize.height ? naturalSize.height * baseScale * zoom : 0

  const imgLeft = VIEWPORT_CENTER + pan.x - renderedWidth / 2
  const imgTop = VIEWPORT_CENTER + pan.y - renderedHeight / 2

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch && e.touches.length === 1) {
      setIsDragging(true)
      dragStartRef.current = {
        mouseX: touch.clientX,
        mouseY: touch.clientY,
        panX: pan.x,
        panY: pan.y,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!isDragging || !touch || e.touches.length !== 1) return
    const dx = touch.clientX - dragStartRef.current.mouseX
    const dy = touch.clientY - dragStartRef.current.mouseY
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    })
  }

  const handleTouchEnd = () => setIsDragging(false)

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.0015
    setZoom((prev) => Math.min(3.5, Math.max(0.5, +(prev + delta).toFixed(2))))
  }

  // Save cropped high-definition image (640x640 Retina quality)
  const handleSave = async () => {
    if (!imgRef.current || !imageSource) return
    setIsProcessing(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const canvas = document.createElement('canvas')
      const targetSize = 640
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ')

      // Maximum image smoothing for ultra-crisp Retina quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Ratio between canvas and preview viewport circle
      const scaleK = targetSize / CROP_DIAMETER
      const finalW = renderedWidth * scaleK
      const finalH = renderedHeight * scaleK
      const centerX = targetSize / 2 + pan.x * scaleK
      const centerY = targetSize / 2 + pan.y * scaleK
      const drawX = centerX - finalW / 2
      const drawY = centerY - finalH / 2

      ctx.drawImage(imgRef.current, drawX, drawY, finalW, finalH)

      const base64 = canvas.toDataURL('image/jpeg', 0.92)
      const res = await uploadAvatar(base64, 'image/jpeg')

      if (!res.success) {
        setError(res.error || 'บันทึกรูปโปรไฟล์ไม่สำเร็จ')
      } else {
        setSuccessMsg('บันทึกรูปโปรไฟล์เรียบร้อยแล้ว!')
        setTimeout(() => {
          onClose()
        }, 800)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('คุณต้องการลบรูปโปรไฟล์นี้ใช่หรือไม่?')) return
    setIsProcessing(true)
    setError(null)
    setSuccessMsg(null)

    const res = await deleteAvatar()
    setIsProcessing(false)

    if (!res.success) {
      setError(res.error || 'ลบรูปไม่สำเร็จ')
    } else {
      setImageSource(null)
      setSuccessMsg('ลบรูปโปรไฟล์เรียบร้อยแล้ว')
      setTimeout(() => {
        onClose()
      }, 700)
    }
  }

  const handleResetFraming = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Background click to dismiss */}
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isProcessing) onClose()
        }}
      />

      <div
        className="relative w-full max-w-[420px] rounded-2xl bg-[#0f1424] border border-slate-800 shadow-2xl p-5 text-slate-200 z-10 animate-scale-in"
        style={{
          boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(147, 51, 234, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center size-8 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Camera className="size-4" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              เปลี่ยนรูปโปรไฟล์
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="size-4 shrink-0 text-emerald-400" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* Crop Viewport */}
        <div className="mt-4 flex flex-col items-center">
          <div
            className="relative overflow-hidden rounded-2xl bg-[#090d16] border border-slate-800/90 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
            style={{
              width: VIEWPORT_SIZE,
              height: VIEWPORT_SIZE,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {imageSource ? (
              <>
                {/* Rendered User Image */}
                <img
                  ref={imgRef}
                  src={imageSource}
                  alt="Crop preview"
                  draggable={false}
                  onLoad={handleImageLoad}
                  className="absolute pointer-events-none select-none max-w-none transition-transform duration-75"
                  style={{
                    width: renderedWidth || 'auto',
                    height: renderedHeight || 'auto',
                    left: imgLeft,
                    top: imgTop,
                    imageRendering: 'auto',
                  }}
                />

                {/* Circular Crop Overlay with Dimmed Corners & White Guide Ring */}
                <svg
                  className="absolute inset-0 size-full pointer-events-none select-none"
                  viewBox={`0 0 ${VIEWPORT_SIZE} ${VIEWPORT_SIZE}`}
                >
                  <defs>
                    <mask id="crop-mask-circle">
                      {/* White reveals the dark background */}
                      <rect width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} fill="white" />
                      {/* Black cuts out the clear circle center */}
                      <circle
                        cx={VIEWPORT_CENTER}
                        cy={VIEWPORT_CENTER}
                        r={CROP_RADIUS}
                        fill="black"
                      />
                    </mask>
                  </defs>

                  {/* Dark mask on outer areas */}
                  <rect
                    width={VIEWPORT_SIZE}
                    height={VIEWPORT_SIZE}
                    fill="rgba(11, 15, 25, 0.72)"
                    mask="url(#crop-mask-circle)"
                  />

                  {/* Clear Circular Border Guide */}
                  <circle
                    cx={VIEWPORT_CENTER}
                    cy={VIEWPORT_CENTER}
                    r={CROP_RADIUS}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                </svg>
              </>
            ) : (
              <div
                className="flex flex-col items-center justify-center text-center p-6 text-slate-400 cursor-pointer hover:text-slate-200 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="grid place-items-center size-14 rounded-2xl bg-white/[0.05] border border-white/10 mb-3 text-purple-400">
                  <ImageIcon className="size-7 stroke-[1.8]" />
                </div>
                <div className="text-xs font-semibold text-white mb-1">
                  ยังไม่ได้เลือกรูปภาพ
                </div>
                <div className="text-[11px] text-slate-400">
                  คลิกที่นี่ หรือปุ่ม "เลือกรูปอื่น" ด้านล่างเพื่ออัปโหลด
                </div>
              </div>
            )}
          </div>

          {/* Zoom Slider Bar */}
          {imageSource && (
            <div className="w-full max-w-[320px] mt-3.5 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
                  title="ซูมออก (-10%)"
                >
                  <ZoomOut className="size-4" />
                </button>

                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.1).toFixed(2)))}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
                  title="ซูมเข้า (+10%)"
                >
                  <ZoomIn className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResetFraming}
                  className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer text-xs ml-1"
                  title="รีเซ็ตตำแหน่งและซูมกลับค่าเริ่มต้น (1.0x)"
                >
                  <RotateCcw className="size-3 text-purple-400" />
                  <span className="text-[11px] font-medium">รีเซ็ต</span>
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-400 select-none">
                ลากรูปเพื่อจัดตำแหน่ง • เลื่อนลูกกลิ้ง/แถบเพื่อซูม
              </p>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Bottom Actions Footer */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/80">
          <div>
            {user?.avatar_url && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                title="ลบรูปโปรไฟล์และกลับไปใช้ไอคอนเริ่มต้น"
              >
                <Trash2 className="size-4" />
                <span>ลบรูป</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer active:scale-95 flex items-center gap-1.5"
              title="เลือกไฟล์รูปภาพต้นฉบับใหม่จากคอมพิวเตอร์"
            >
              <Upload className="size-3.5 text-slate-400" />
              <span>เลือกรูปต้นฉบับ</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing || !imageSource}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                boxShadow: '0 4px 16px rgba(147, 51, 234, 0.4)',
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>กำลังบันทึก…</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>บันทึกรูป</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
