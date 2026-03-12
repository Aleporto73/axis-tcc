import { requireTCCLicense } from '@/src/lib/tcc-license-gate'

export default async function SessoesLayout({ children }: { children: React.ReactNode }) {
  await requireTCCLicense()
  return <>{children}</>
}
