'use client'
import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignUpForm() {
  const searchParams = useSearchParams()
  const produto = searchParams.get('produto')

  const redirectUrl = produto === 'aba' ? '/aba/dashboard' : '/dashboard'

  return (
    <SignUp
      appearance={{
        elements: {
          formButtonPrimary: {
            backgroundColor: produto === 'aba' ? '#c46a50' : '#2563EB',
            '&:hover': { backgroundColor: produto === 'aba' ? '#B4532F' : '#1d4ed8' }
          }
        }
      }}
      fallbackRedirectUrl={redirectUrl}
      signInUrl={produto === 'aba' ? '/sign-in?produto=aba' : '/sign-in'}
    />
  )
}

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC'
    }}>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </div>
  )
}
