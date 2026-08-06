import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  rounded?: 'full' | 'xl' | '2xl' | 'lg'
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

const radii = {
  full: 'rounded-full',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

export function BrandLogo({ size = 'md', className, rounded = 'xl' }: BrandLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="BD Dashboard"
      className={cn(
        'object-cover shrink-0 border border-border shadow-sm',
        sizes[size],
        radii[rounded],
        className
      )}
    />
  )
}
