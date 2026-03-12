import { requireTCCLicense } from '@/src/lib/tcc-license-gate'

export default async function PacientesLayout({ children }: { children: React.ReactNode }) {
  await requireTCCLicense()
  return <>{children}</>
}
