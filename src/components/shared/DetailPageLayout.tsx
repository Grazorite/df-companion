import type { ReactNode } from 'react'
import { detailPageClassName } from '../../utils/detailPageLayout'

interface DetailPageLayoutProps {
  children: ReactNode
  className?: string
}

export default function DetailPageLayout({ children, className }: DetailPageLayoutProps) {
  return <main className={detailPageClassName(className)}>{children}</main>
}
