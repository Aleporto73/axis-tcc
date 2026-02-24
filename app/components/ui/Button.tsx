'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'critical' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'touch'
  isLoading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    isLoading = false,
    fullWidth = false,
    disabled,
    children,
    ...props 
  }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out rounded-clinical focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-clinical-primary focus-visible:ring-offset-4 disabled:opacity-50 disabled:cursor-not-allowed"
    
    const variants = {
      primary: "bg-clinical-primary text-white hover:bg-blue-700 active:bg-blue-800 shadow-clinical-card",
      secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300",
      ghost: "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
      critical: "bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 shadow-clinical-card",
      success: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-clinical-card",
    }
    
    const sizes = {
      sm: "px-3 py-1.5 text-sm gap-1.5",
      md: "px-4 py-2.5 text-body gap-2",
      lg: "px-6 py-3.5 text-body gap-2.5",
      touch: "px-6 py-4 text-body gap-2.5 min-h-touch-target",
    }
    
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg 
              className="animate-spin h-4 w-4" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processando...</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
