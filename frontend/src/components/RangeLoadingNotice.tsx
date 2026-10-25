import type { FC } from 'react'
import { RefreshCw } from 'lucide-react'
import { toThaiDate } from '@/lib/format'
import type { DateRange } from '@/types/herbdx.types'

interface RangeLoadingNoticeProps {
  readonly range: DateRange
}

/**
 * แจ้งสถานะระหว่างโหลดช่วงวันที่ใหม่ (ตารางและตัวเลขที่เห็นยังเป็นของช่วงก่อนหน้า)
 * ใช้ร่วมกันทุกหน้า เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าข้อมูลหายหรือระบบค้าง
 */
export const RangeLoadingNotice: FC<RangeLoadingNoticeProps> = ({ range }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2.5 text-xs font-medium text-violet-800 dark:text-violet-200"
  >
    <RefreshCw className="size-3.5 shrink-0 animate-spin" />
    <span>
      กำลังโหลดข้อมูล {toThaiDate(range.startDate)} – {toThaiDate(range.endDate)} จาก HOSxP… ช่วงยาวอาจใช้เวลาสักครู่ ข้อมูลที่เห็นยังเป็นของช่วงก่อนหน้า
    </span>
  </div>
)
