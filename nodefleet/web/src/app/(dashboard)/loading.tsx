export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <div className="h-4 w-24 bg-slate-700 rounded mb-3" />
            <div className="h-8 w-16 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
        <div className="h-6 w-40 bg-slate-700 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-4 bg-slate-700 rounded-full" />
              <div className="h-4 flex-1 bg-slate-700 rounded" />
              <div className="h-4 w-20 bg-slate-700 rounded" />
              <div className="h-4 w-24 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
