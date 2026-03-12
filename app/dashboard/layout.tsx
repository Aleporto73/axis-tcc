import { requireTCCLicense } from '@/src/lib/tcc-license-gate'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireTCCLicense()
  return <>{children}</>
}
