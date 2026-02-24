'use client'
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC'
    }}>
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary: {
              backgroundColor: '#2563EB',
              '&:hover': { backgroundColor: '#1d4ed8' }
            }
          }
        }}
        fallbackRedirectUrl="/dashboard"
        signInUrl="/sign-in"
      />
    </div>
  )
}
