import { requireTCCLicense } from '@/src/lib/tcc-license-gate'
import OnboardingTCC from '../components/OnboardingTCC'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireTCCLicense()
  return (
    <>
      <OnboardingTCC />
      {children}
    </>
  )
}
