import { useState, useRef, type FC, type ChangeEvent, type DragEvent } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DxMapRecord, DxMapBatchItem } from '@/types/herbdx.types'
import { useBatchUpdateDxMap } from '@/hooks/useHerbDx'
import {
  parseDxMapFromExcel,
  exportDxMapToExcel,
  type ParsedDxMapResult,
} from '@/lib/dxMapExcel'

interface DxMapImportModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly existingMap: readonly DxMapRecord[]
  readonly onImportSuccess?: (count: number) => void
}

type FilterTab = 'changed' | 'all' | 'invalid'

export const DxMapImportModal: FC<DxMapImportModalProps> = ({
  isOpen,
  onClose,
  existingMap,
  onImportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedResult, setParsedResult] = useState<ParsedDxMapResult | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('changed')
  const [tableSearch, setTableSearch] = useState('')
  const [mergeWithExisting, setMergeWithExisting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { mutate: batchUpdate, isPending: isSaving } = useBatchUpdateDxMap()

  if (!isOpen) return null

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setParseError('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น')
      return
    }

    setIsLoadingFile(true)
    setParseError(null)
    setStatusMessage(null)

    try {
      const result = await parseDxMapFromExcel(file, existingMap)
      setParsedResult(result)
      setActiveFilter(result.changedCount > 0 ? 'changed' : 'all')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'อ่านไฟล์ Excel ไม่สำเร็จ')
      setParsedResult(null)
    } finally {
      setIsLoadingFile(false)
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleResetFile = () => {
    setParsedResult(null)
    setParseError(null)
    setStatusMessage(null)
    setTableSearch('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Filter items in preview table
  const filteredItems = (parsedResult?.items || []).filter((item) => {
    // Tab filter
    if (activeFilter === 'changed' && !item.hasChanges) return false
    if (activeFilter === 'invalid' && item.invalid_codes.length === 0) return false

    // Search filter
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase()
      const matchIcode = item.icode.toLowerCase().includes(q)
      const matchName = item.drug_name.toLowerCase().includes(q)
      const matchNewCodes = item.new_dx_prefixes.toLowerCase().includes(q)
      const matchOldCodes = item.old_dx_prefixes.toLowerCase().includes(q)
      if (!matchIcode && !matchName && !matchNewCodes && !matchOldCodes) return false
    }

    return true
  })

  // Determine items to submit
  // If user is merging or overwriting, we submit items that have changes (or all valid items)
  const itemsToSubmit: DxMapBatchItem[] = (parsedResult?.items || [])
    .filter((item) => item.hasChanges && !item.isNotFound)
    .map((item) => ({
      icode: item.icode,
      drug_name: item.drug_name,
      dx_prefixes: item.new_dx_prefixes,
      min_qty: item.new_min_qty,
      indication: item.new_indication,
      mergeWithExisting,
    }))

  const handleConfirmImport = () => {
    if (itemsToSubmit.length === 0) {
      setStatusMessage({ type: 'error', text: 'ไม่พบรายการที่มีการเปลี่ยนแปลงเพื่อบันทึก' })
      return
    }

    batchUpdate(itemsToSubmit, {
      onSuccess: (res) => {
        setStatusMessage({
          type: 'success',
          text: `นำเข้าและบันทึกข้อมูลเกณฑ์ ICD-10 สำเร็จ ${res.updatedCount} รายการเรียบร้อยแล้ว`,
        })
        onImportSuccess?.(res.updatedCount)
        setTimeout(() => {
          onClose()
        }, 1500)
      },
      onError: (err) => {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        })
      },
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#111425] border border-slate-200 dark:border-[#2b2746] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                นำเข้าเกณฑ์ ICD-10 จากไฟล์ Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ระบบจะตรวจสอบความถูกต้องและเปรียบเทียบรหัสเดิมกับรหัสใหม่ก่อนบันทึก
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={cn(
              'px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b transition-all',
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/40'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border-rose-200 dark:border-rose-800/40'
            )}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!parsedResult ? (
            /* STEP 1: Upload Dropzone */
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all',
                  isDragging
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-300 dark:border-[#383354] hover:border-violet-400 dark:hover:border-violet-500/50 bg-slate-50/50 dark:bg-[#16192e]/60'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {isLoadingFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-10 text-violet-500 animate-spin" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      กำลังอ่านและประมวลผลไฟล์ Excel...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="size-14 rounded-2xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-3 shadow-inner">
                      <Upload className="size-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center">
                      คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ Excel (.xlsx) มาวางที่นี่
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
                      รองรับไฟล์ .xlsx ที่ส่งออกจากระบบหรือมีคอลัมน์ "รหัสยา" และ "รหัส ICD-10"
                    </p>
                  </>
                )}
              </div>

              {parseError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <p>{parseError}</p>
                </div>
              )}

              {/* Instructions & Template download option */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161a30] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      ยังไม่มีไฟล์สำหรับนำเข้า?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ส่งออกรายการเกณฑ์ปัจจุบันทั้งหมด เพื่อนำไปคัดกรองและแก้ไขรหัส ICD-10 ได้สะดวกรวดเร็ว
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportDxMapToExcel(existingMap)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                  >
                    <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ส่งออกไฟล์แม่แบบ (Excel)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Preview & Diff */
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#161a30] border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {parsedResult.fileName}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({parsedResult.totalRows} รายการ)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetFile}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                >
                  เลือกไฟล์อื่น
                </button>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161a30] border border-slate-200 dark:border-white/5 text-center">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">ทั้งหมดในไฟล์</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {parsedResult.totalRows}
                  </p>
                </div>

                <div
                  onClick={() => setActiveFilter('changed')}
                  className={cn(
                    'p-3 rounded-xl border text-center cursor-pointer transition-all',
                    activeFilter === 'changed'
                      ? 'bg-violet-500/15 border-violet-500/50 shadow-xs ring-1 ring-violet-500'
                      : 'bg-slate-50 dark:bg-[#161a30] border-slate-200 dark:border-white/5 hover:border-violet-400'
                  )}
                >
                  <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                    มีการเปลี่ยนแปลง
                  </p>
                  <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                    {parsedResult.changedCount}
                  </p>
                </div>

                <div
                  onClick={() => setActiveFilter('all')}
                  className={cn(
                    'p-3 rounded-xl border text-center cursor-pointer transition-all',
                    activeFilter === 'all'
                      ? 'bg-slate-200/80 dark:bg-white/15 border-slate-400 dark:border-white/30 shadow-xs'
                      : 'bg-slate-50 dark:bg-[#161a30] border-slate-200 dark:border-white/5 hover:border-slate-300'
                  )}
                >
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">รหัสคงเดิม</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {parsedResult.unchangedCount}
                  </p>
                </div>

                <div
                  onClick={() => parsedResult.invalidCount > 0 && setActiveFilter('invalid')}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all',
                    parsedResult.invalidCount > 0
                      ? activeFilter === 'invalid'
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-xs ring-1 ring-amber-500 cursor-pointer'
                        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40 cursor-pointer'
                      : 'bg-slate-50 dark:bg-[#161a30] border-slate-200 dark:border-white/5 opacity-50'
                  )}
                >
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    มีรหัสผิดรูปแบบ
                  </p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {parsedResult.invalidCount}
                  </p>
                </div>
              </div>

              {/* Mode Settings */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-500/25">
                <div>
                  <span className="text-xs font-bold text-violet-900 dark:text-violet-200 block">
                    วิธีการนำเข้ารหัส ICD-10
                  </span>
                  <span className="text-[11px] text-violet-700 dark:text-violet-300">
                    {mergeWithExisting
                      ? 'โหมดรวมรหัส: คงรหัสเดิมไว้ทั้งหมด และเพิ่มเฉพาะรหัสใหม่เข้าไป'
                      : 'โหมดแทนที่ (แนะนำ): นำรหัสจาก Excel มาใช้แทนรหัสเดิมทั้งหมด'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 bg-white/80 dark:bg-black/30 p-1 rounded-xl border border-violet-200 dark:border-violet-500/30">
                  <button
                    type="button"
                    onClick={() => setMergeWithExisting(false)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer',
                      !mergeWithExisting
                        ? 'bg-violet-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    แทนที่ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergeWithExisting(true)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer',
                      mergeWithExisting
                        ? 'bg-violet-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    รวมกับรหัสเดิม
                  </button>
                </div>
              </div>

              {/* Search in preview */}
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="ค้นหารหัสยา, ชื่อยา หรือรหัสโรค..."
                    className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-[#383354] bg-white dark:bg-[#161a30] text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  แสดง {filteredItems.length} จาก {parsedResult.totalRows} รายการ
                </span>
              </div>

              {/* Preview Diff Table */}
              <div className="border border-slate-200 dark:border-[#2b2746] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-[#181c35] text-slate-600 dark:text-slate-300 sticky top-0 border-b border-slate-200 dark:border-white/10 z-10">
                    <tr>
                      <th className="py-2 px-3 font-semibold w-12 text-center">แถว</th>
                      <th className="py-2 px-3 font-semibold min-w-[160px]">รายการยาสมุนไพร</th>
                      <th className="py-2 px-3 font-semibold min-w-[180px]">รหัสเดิมในระบบ</th>
                      <th className="py-2 px-3 font-semibold min-w-[220px]">รหัสใหม่จาก Excel</th>
                      <th className="py-2 px-3 font-semibold text-center w-28">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <tr
                          key={item.icode}
                          className={cn(
                            'transition-colors',
                            item.hasChanges
                              ? 'bg-violet-50/40 dark:bg-violet-950/10'
                              : 'hover:bg-slate-50/60 dark:hover:bg-white/5'
                          )}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">
                            {item.rowNumber}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-800 dark:text-slate-100 block">
                              {item.drug_name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              รหัส: {item.icode}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {item.old_codes.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {item.old_codes.map((c) => (
                                  <span
                                    key={c}
                                    className="px-1.5 py-0.2 rounded text-[11px] font-mono bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">ไม่มีรหัส</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {item.new_codes.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[260px]">
                                {item.new_codes.map((c) => {
                                  const isAdded = item.added_codes.includes(c)
                                  return (
                                    <span
                                      key={c}
                                      className={cn(
                                        'px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border',
                                        isAdded
                                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                                      )}
                                    >
                                      {isAdded ? `+${c}` : c}
                                    </span>
                                  )
                                })}
                                {item.removed_codes.map((c) => (
                                  <span
                                    key={c}
                                    className="px-1.5 py-0.2 rounded text-[11px] font-mono line-through bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60"
                                    title="รหัสนี้จะถูกลบออก"
                                  >
                                    -{c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-rose-500 italic text-[11px]">ลบทุกรหัสออก</span>
                            )}

                            {item.invalid_codes.length > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="size-3 shrink-0" />
                                <span>รหัสผิดรูปแบบ: {item.invalid_codes.join(', ')}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.isNotFound ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                ไม่พบยานี้
                              </span>
                            ) : item.hasChanges ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700/50">
                                มีการแก้ไข
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400">
                                คงเดิม
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                          ไม่พบรายการตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsedResult ? (
              <span>
                พร้อมบันทึก{' '}
                <strong className="text-violet-600 dark:text-violet-400 font-bold">
                  {itemsToSubmit.length}
                </strong>{' '}
                รายการที่มีการเปลี่ยนแปลง
              </span>
            ) : (
              <span>รองรับเฉพาะไฟล์ .xlsx และ .xls</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            {parsedResult && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || itemsToSubmit.length === 0}
                className="btn-pill-action px-5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    <span>ยืนยันบันทึกข้อมูล ({itemsToSubmit.length} รายการ)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
