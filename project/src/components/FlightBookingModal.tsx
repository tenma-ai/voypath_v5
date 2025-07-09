import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, Plane, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';

interface FlightBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeData: {
    from: string;
    to: string;
    fromLat?: number;
    fromLng?: number;
    toLat?: number;
    toLng?: number;
  };
  dayData: any;
  timeSlot: string;
}


const FlightBookingModal: React.FC<FlightBookingModalProps> = ({
  isOpen,
  onClose,
  routeData,
  dayData,
  timeSlot
}) => {
  const { currentTrip } = useStore();


  // MapView Trip.com booking function (direct reuse)
  const generateTripComFlightUrl = (origin: string, destination: string, dateStr: string) => {
    const tripComUrl = `https://trip.com/flights/booking?flightType=ow&dcity=${origin}&acity=${destination}&ddate=${dateStr}&adult=1&child=0&infant=0`;
    const encodedUrl = encodeURIComponent(tripComUrl);
    return `https://tp.media/r?marker=649297&trs=434567&p=8626&u=${encodedUrl}&campaign_id=121`;
  };

  const handleTripComBooking = () => {
    const departureDate = dayData?.date || new Date().toISOString().split('T')[0];
    const dateStr = departureDate.replace(/-/g, '');
    const url = generateTripComFlightUrl(routeData.from, routeData.to, dateStr);
    window.open(url, '_blank');
  };


  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      {/* Backdrop */}
      <motion.div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          className="w-full max-w-3xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[90vh]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  Flight Booking
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {routeData.from} → {routeData.to}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[500px]">
          {/* Direct Trip.com Booking */}
          <div className="p-6 text-center">
            <div className="space-y-6">
              <div className="flex items-center justify-center space-x-3">
                <div className="text-4xl">✈️</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Flight Booking
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {routeData.from} → {routeData.to}
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  Departure: {dayData?.date || 'Not specified'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Search and book flights directly on Trip.com
                </p>
              </div>
              
              <button
                onClick={handleTripComBooking}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Book Flight on Trip.com</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {routeData.from} to {routeData.to} flights
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default FlightBookingModal;