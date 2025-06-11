import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Users, TrendingUp, CheckCircle } from 'lucide-react';
import { TripOptimizationService, OptimizedRoute } from '../services/TripOptimizationService';

interface OptimizationResultProps {
  result: OptimizedRoute;
  onClose?: () => void;
}

export function OptimizationResult({ result, onClose }: OptimizationResultProps) {
  const formattedResult = TripOptimizationService.formatOptimizationResult(result);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Route Optimization Complete
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {formattedResult.summary}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-6 h-6 text-green-500" />
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Places</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formattedResult.totalStats.places}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Travel</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {TripOptimizationService.formatMinutes(formattedResult.totalStats.travelTime)}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Visit Time</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {TripOptimizationService.formatMinutes(formattedResult.totalStats.visitTime)}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Score</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {Math.round(formattedResult.totalStats.score * 100)}%
          </div>
        </div>
      </div>

      {/* Optimization Score Breakdown */}
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Optimization Breakdown</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Fairness</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {Math.round(result.optimization_score.fairness * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${result.optimization_score.fairness * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Efficiency</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {Math.round(result.optimization_score.efficiency * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${result.optimization_score.efficiency * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Daily Schedules */}
      <div>
        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Daily Schedule</h4>
        <div className="space-y-4">
          {Object.entries(formattedResult.schedulesByDay).map(([date, places]) => (
            <div key={date} className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
              <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                {date === 'day-1' ? 'Day 1' : new Date(date).toLocaleDateString()}
              </h5>
              <div className="space-y-2">
                {places.map((scheduledPlace, index) => (
                  <div key={index} className="flex items-center space-x-3 text-sm">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium">
                      {scheduledPlace.order_in_day}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {scheduledPlace.place.name}
                      </span>
                      <div className="text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(scheduledPlace.arrival_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} - {new Date(scheduledPlace.departure_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                      <span className="text-xs">
                        {TripOptimizationService.getTransportIcon(scheduledPlace.transport_mode)}
                      </span>
                      {scheduledPlace.travel_time_from_previous > 0 && (
                        <span className="text-xs">
                          {TripOptimizationService.formatMinutes(scheduledPlace.travel_time_from_previous)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Info */}
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-4 border-t border-slate-200 dark:border-slate-600">
        Optimization completed in {result.execution_time_ms}ms
      </div>
    </motion.div>
  );
}