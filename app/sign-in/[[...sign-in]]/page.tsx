'use client'
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC'
    }}>
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: {
              backgroundColor: '#2563EB',
              '&:hover': { backgroundColor: '#1d4ed8' }
            }
          }
        }}
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
      />
    </div>
  )
}
