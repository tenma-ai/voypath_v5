// Just checking the basic structure around lines 288-325
<div className="relative z-10">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <h1 className="text-base font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
        {trip.name}
      </h1>
      
      {/* Trip dates and members info */}
      {trip.startDate && trip.endDate && (
        <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400">
          <Calendar className="w-3 h-3" />
          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
        </div>
      )}
      <div className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-400">
        <Users className="w-3 h-3" />
        <span>{trip.memberCount}</span>
      </div>
    </div>
    
    {/* Settings Button */}
    <motion.button>
      <Settings className="w-4 h-4" />
    </motion.button>
  </div>
</div>