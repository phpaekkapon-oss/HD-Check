import type { FC } from 'react'
import { usePrivacy } from '@/context/PrivacyContext'
import { maskHn, maskName } from '@/lib/privacy'

interface PhiProps {
  readonly value: string | null | undefined
}

/** ชื่อผู้รับบริการ — ปกปิดเมื่อเปิดโหมดปกปิดข้อมูล */
export const PhiName: FC<PhiProps> = ({ value }) => {
  const { hidden } = usePrivacy()
  return <>{hidden ? maskName(value) : (value ?? '')}</>
}

/** HN — ปกปิดเมื่อเปิดโหมดปกปิดข้อมูล */
export const PhiHn: FC<PhiProps> = ({ value }) => {
  const { hidden } = usePrivacy()
  return <>{hidden ? maskHn(value) : (value ?? '')}</>
}
