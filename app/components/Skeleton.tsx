export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-100 rounded ${className}`} />
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="hidden md:grid grid-cols-10 gap-4 pb-3 border-b border-slate-200">
        <Skeleton className="col-span-2 h-3 w-16" />
        <Skeleton className="col-span-4 h-3 w-20" />
        <Skeleton className="col-span-1 h-3 w-10 mx-auto" />
        <Skeleton className="col-span-3 h-3 w-14" />
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-10 gap-4 py-4 border-b border-slate-100">
          <div className="col-span-2 flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="col-span-4">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="col-span-1 flex justify-center">
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <div className="col-span-3 flex items-center gap-1.5">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

export function PatientTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-slate-200">
        <Skeleton className="col-span-3 h-3 w-12" />
        <Skeleton className="col-span-3 h-3 w-12" />
        <Skeleton className="col-span-2 h-3 w-16" />
        <Skeleton className="col-span-1 h-3 w-14" />
        <Skeleton className="col-span-2 h-3 w-20" />
        <Skeleton className="col-span-1 h-3 w-10 mx-auto" />
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-4 py-4 border-b border-slate-100">
          <div className="col-span-3">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="col-span-3">
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="col-span-2">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="col-span-1 flex justify-center">
            <Skeleton className="h-4 w-6" />
          </div>
          <div className="col-span-2">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="col-span-1 flex justify-center">
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      <div className="mb-6">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
