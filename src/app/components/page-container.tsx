interface PageContainerProps {
  children: React.ReactNode
  className?: string
  narrow?: boolean
}

export function PageContainer({ children, className, narrow }: PageContainerProps) {
  return (
    <div className={['mx-auto w-full px-4 sm:px-6 lg:px-8', narrow ? 'max-w-5xl' : 'max-w-6xl', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
