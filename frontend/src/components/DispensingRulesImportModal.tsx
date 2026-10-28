import { useState, useRef, type FC, type ChangeEvent, type DragEvent } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DispensingRule } from '@/types/herbdx.types'
import { useBatchSaveDispensingRules } from '@/hooks/useHerbDx'
import {
  parseDispensingRulesFromExcel,
  exportDispensingRulesToExcel,
  type ParsedDispensingRulesResult,
} from '@/lib/dispensingRulesExcel'

interface DispensingRulesImportModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly existingRules: readonly DispensingRule[]
  readonly onImportSuccess?: (count: number) => void
}

type FilterTab = 'changed' | 'all' | 'new' | 'invalid'

export const DispensingRulesImportModal: FC<DispensingRulesImportModalProps> = ({
  isOpen,
  onClose,
  existingRules,
  onImportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedResult, setParsedResult] = useState<ParsedDispensingRulesResult | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('changed')
  const [tableSearch, setTableSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { mutate: batchSave, isPending: isSaving } = useBatchSaveDispensingRules()

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
      const result = await parseDispensingRulesFromExcel(file, existingRules)
      setParsedResult(result)
      setActiveFilter(result.changedCount > 0 || result.newCount > 0 ? 'changed' : 'all')
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
    if (activeFilter === 'changed' && !item.hasChanges && !item.isNew) return false
    if (activeFilter === 'new' && !item.isNew) return false
    if (activeFilter === 'invalid' && !item.invalidDays) return false

    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase()
      const matchIcode = item.drug_icode.toLowerCase().includes(q)
      const matchName = item.drug_name.toLowerCase().includes(q)
      const matchPttype = item.new_pttype_name_label.toLowerCase().includes(q)
      const matchDesc = item.new_rule_description.toLowerCase().includes(q)
      if (!matchIcode && !matchName && !matchPttype && !matchDesc) return false
    }

    return true
  })

  // Confirm import
  const handleConfirmImport = () => {
    if (!parsedResult) return

    // Save items that have changes or are new, and are not invalid
    const candidateItems = parsedResult.items.filter((i) => (i.hasChanges || i.isNew) && !i.invalidDays)

    if (candidateItems.length === 0) {
      window.alert('ไม่พบรายการที่มีการเปลี่ยนแปลงหรือเงื่อนไขใหม่ที่จะบันทึก')
      return
    }

    const payload: Partial<DispensingRule>[] = candidateItems.map((item) => ({
      id: item.id,
      drug_icode: item.drug_icode,
      drug_name: item.drug_name,
      min_interval_days: item.new_min_interval_days,
      pttype_name_label: item.new_pttype_name_label,
      pttype_filter: item.new_pttype_filter,
      rule_description: item.new_rule_description,
      is_active: item.new_is_active,
    }))

    batchSave(payload, {
      onSuccess: (res) => {
        setStatusMessage({
          type: 'success',
          text: `นำเข้าเงื่อนไขรอบการจ่ายสำเร็จ ${res.count ?? payload.length} รายการ`,
        })
        onImportSuccess?.(res.count ?? payload.length)
        setTimeout(() => {
          onClose()
        }, 1200)
      },
      onError: (err) => {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'บันทึกเงื่อนไขไม่สำเร็จ',
        })
      },
    })
  }

  const itemsToSaveCount = (parsedResult?.items || []).filter(
    (i) => (i.hasChanges || i.isNew) && !i.invalidDays
  ).length

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-5xl rounded-3xl bg-white dark:bg-[#12152b] border border-slate-200 dark:border-[#292440] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-[#292440] bg-slate-50/70 dark:bg-[#161a33]/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 grid place-items-center text-amber-700 dark:text-amber-400">
              <Upload className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                นำเข้าเงื่อนไขรอบการจ่ายยาสมุนไพรจากไฟล์ Excel (.xlsx)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ระบบจะตรวจสอบรอบการจ่าย (วัน), สิทธิการรักษา และสถานะ พร้อมแสดงความเปลี่ยนแปลงให้เปรียบเทียบก่อนบันทึก
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 grid place-items-center transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={cn(
                'rounded-2xl p-4 flex items-start gap-3 border text-xs',
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
              )}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{statusMessage.text}</div>
            </div>
          )}

          {/* Upload Zone (Show if no file loaded yet) */}
          {!parsedResult && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3',
                  isDragging
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 scale-[0.99]'
                    : 'border-slate-300 dark:border-[#34304a] hover:border-amber-400 hover:bg-slate-50 dark:hover:bg-white/5'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="size-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 grid place-items-center text-amber-700 dark:text-amber-400">
                  {isLoadingFile ? (
                    <Loader2 className="size-8 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-8" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isLoadingFile
                      ? 'กำลังประมวลผลไฟล์ Excel…'
                      : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ Excel (.xlsx) มาวางที่นี่'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    รองรับไฟล์ Excel ของ SMART-HOSCHECK ที่ส่งออกจากปุ่ม "ส่งออก Excel"
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">
                  <Upload className="size-3.5" />
                  เลือกไฟล์จากเครื่องคอมพิวเตอร์
                </div>
              </div>

              {parseError && (
                <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div>
                    <strong className="block font-bold">ไม่สามารถอ่านไฟล์ได้</strong>
                    {parseError}
                  </div>
                </div>
              )}

              {/* Instructions banner */}
              <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 p-4 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <Clock className="size-4" />
                  คำแนะนำสำหรับการนำเข้าเงื่อนไขรอบการจ่าย
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                  <li>
                    หากยังไม่มีไฟล์ตั้งต้น แนะนำให้คลิก{' '}
                    <button
                      type="button"
                      onClick={() => void exportDispensingRulesToExcel(existingRules)}
                      className="text-amber-700 dark:text-amber-400 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="size-3" /> ส่งออก Excel
                    </button>{' '}
                    เพื่อนำไปแก้ไขตัวเลขรอบวัน
                  </li>
                  <li>สามารถปรับปรุงคอลัมน์ "รอบการจ่าย (วัน)", "สถานะ", หรือ "คำอธิบายเงื่อนไข" ในไฟล์ได้ตามสะดวก</li>
                  <li>ห้ามแก้ไขคอลัมน์ "รหัสยา (icode)" เพราะเป็นรหัสที่ใช้จับคู่เข้ากับฐานข้อมูล</li>
                </ul>
              </div>
            </div>
          )}

          {/* Preview Results (Show if parsed file) */}
          {parsedResult && (
            <div className="space-y-4">
              {/* File details & Stats bar */}
              <div className="rounded-2xl bg-slate-100/70 dark:bg-[#161a33] border border-slate-200 dark:border-[#292440] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-amber-500/15 border border-amber-500/25 grid place-items-center text-amber-700 dark:text-amber-400 shrink-0">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-slate-900 dark:text-white">
                        {parsedResult.fileName}
                      </strong>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-medium">
                        {parsedResult.totalRows} แถว
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ตรวจพบความเปลี่ยนแปลง {parsedResult.changedCount} รายการ • เพิ่มใหม่ {parsedResult.newCount} รายการ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/5 transition cursor-pointer"
                  >
                    เลือกไฟล์อื่น
                  </button>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('changed')}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0',
                      activeFilter === 'changed'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    )}
                  >
                    <span>มีการเปลี่ยนแปลง</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20">
                      {parsedResult.changedCount}
                    </span>
                  </button>

                  {parsedResult.newCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('new')}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0',
                        activeFilter === 'new'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                      )}
                    >
                      <span>เงื่อนไขใหม่</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20">
                        {parsedResult.newCount}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0',
                      activeFilter === 'all'
                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    )}
                  >
                    <span>ทั้งหมดในไฟล์</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20">
                      {parsedResult.totalRows}
                    </span>
                  </button>

                  {parsedResult.invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('invalid')}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0',
                        activeFilter === 'invalid'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/20'
                      )}
                    >
                      <AlertTriangle className="size-3" />
                      <span>ข้อมูลไม่ถูกต้อง</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20">
                        {parsedResult.invalidCount}
                      </span>
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="ค้นหาในตารางตัวอย่าง…"
                    className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] ring-1 ring-slate-200 dark:ring-[#34304a] pl-8.5 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[46vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 dark:bg-[#161a33] text-slate-700 dark:text-slate-200 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-[#292440]">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-14">แถว</th>
                        <th className="py-2.5 px-3 text-center w-24">รหัสยา</th>
                        <th className="py-2.5 px-4 min-w-[200px]">รายการยาสมุนไพร</th>
                        <th className="py-2.5 px-4 min-w-[190px]">การเปลี่ยนแปลงรอบการจ่าย</th>
                        <th className="py-2.5 px-3 min-w-[150px]">สิทธิการรักษา</th>
                        <th className="py-2.5 px-3 text-center w-28">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#292440]/60">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                            ไม่พบรายการที่ตรงกับตัวกรอง
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          return (
                            <tr
                              key={`${item.drug_icode}_${item.rowNumber}`}
                              className={cn(
                                'hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors',
                                item.isNew && 'bg-sky-50/30 dark:bg-sky-950/15',
                                item.hasChanges && !item.isNew && 'bg-amber-50/30 dark:bg-amber-950/15',
                                item.invalidDays && 'bg-rose-50/30 dark:bg-rose-950/15'
                              )}
                            >
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                                {item.rowNumber}
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                {item.drug_icode}
                              </td>

                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {item.drug_name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {item.new_rule_description}
                                </div>
                              </td>

                              <td className="py-2.5 px-4">
                                {item.isNew ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                                      ตัด {item.new_min_interval_days} วัน (ใหม่)
                                    </span>
                                  </div>
                                ) : item.isIntervalChanged ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-xs line-through text-slate-400 bg-slate-100 dark:bg-white/10">
                                      {item.old_min_interval_days} วัน
                                    </span>
                                    <ArrowRight className="size-3 text-amber-500 shrink-0" />
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                      ตัด {item.new_min_interval_days} วัน
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 dark:text-slate-300 font-mono">
                                    ตัดการจ่าย {item.new_min_interval_days} วัน
                                  </span>
                                )}

                                {item.invalidDays && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                    <AlertTriangle className="size-3" /> จำนวนวันไม่ถูกต้อง (ใช้อย่างน้อย 1 วัน)
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                  {item.new_pttype_name_label}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.new_pttype_filter}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                {item.isActiveChanged ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] line-through text-slate-400">
                                      {item.old_is_active ? 'เปิด' : 'ปิด'}
                                    </span>
                                    <span
                                      className={cn(
                                        'px-2 py-0.5 rounded-full text-[11px] font-bold border',
                                        item.new_is_active
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                                          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 border-slate-300'
                                      )}
                                    >
                                      {item.new_is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                    </span>
                                  </div>
                                ) : (
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-full text-[11px] font-medium',
                                      item.new_is_active
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                                    )}
                                  >
                                    {item.new_is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#292440] bg-slate-50/80 dark:bg-[#161a33]/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsedResult ? (
              <span>
                พร้อมบันทึก{' '}
                <strong className="text-amber-700 dark:text-amber-300 font-bold">
                  {itemsToSaveCount}
                </strong>{' '}
                รายการเงื่อนไข
              </span>
            ) : (
              <span>คลิก 'ส่งออก Excel' หากต้องการดาวน์โหลดแบบฟอร์มที่มีข้อมูลปัจจุบันไปแก้ไข</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>

            {parsedResult && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || itemsToSaveCount === 0}
                className="btn-pill-action inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>กำลังบันทึกข้อมูล…</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    <span>ยืนยันบันทึกข้อมูล ({itemsToSaveCount} รายการ)</span>
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
