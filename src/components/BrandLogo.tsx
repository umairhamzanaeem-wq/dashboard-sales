import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  rounded?: 'full' | 'xl' | '2xl' | 'lg'
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
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
      alt="Company logo"
      className={cn(
        'object-cover shrink-0 border border-border/60 shadow-sm',
        sizes[size],
        radii[rounded],
        className
      )}
    />
  )
}
