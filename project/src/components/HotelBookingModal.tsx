import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Bed } from 'lucide-react';
import { useStore } from '../store/useStore';

interface HotelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: any;
  timeSlot: string;
  nearbyLocation?: {
    lat: number;
    lng: number;
    name: string;
  };
}


const HotelBookingModal: React.FC<HotelBookingModalProps> = ({
  isOpen,
  onClose,
  dayData,
  timeSlot,
  nearbyLocation
}) => {
  const { currentTrip } = useStore();


  // MapView Trip.com booking function (direct reuse)
  const generateTripComHotelUrl = (city: string, checkIn: string, checkOut: string) => {
    const baseUrl = 'https://tp.media/r?marker=649297&trs=434567&p=8626&u=https%3A%2F%2Ftrip.com%2Fhotels%2Flist';
    const params = new URLSearchParams({
      city: city,
      cityName: city,
      checkin: checkIn.replace(/-/g, '%2F'),
      checkout: checkOut.replace(/-/g, '%2F'),
      adult: '1',
      children: '0',
      crn: '1',
      searchType: 'CT',
      searchWord: city,
      'locale': 'en-XX',
      'curr': 'JPY'
    });
    return `${baseUrl}?${params.toString()}&campaign_id=121`;
  };

  const handleTripComBooking = () => {
    const checkInDate = dayData?.date || new Date().toISOString().split('T')[0];
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    
    const city = nearbyLocation?.name || 'Tokyo';
    const url = generateTripComHotelUrl(city, checkInDate, checkOutDate.toISOString().split('T')[0]);
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
          className="w-full max-w-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[90vh]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Bed className="w-5 h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                  Hotel Booking
                </Dialog.Title>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {timeSlot} • {dayData?.date} • Near {nearbyLocation?.name || 'current location'}
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
                <div className="text-4xl">🏨</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Hotel Booking
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Near {nearbyLocation?.name || 'current location'}
                  </p>
                </div>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                  Check-in: {dayData?.date || 'Not specified'}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Search and book hotels directly on Trip.com
                </p>
              </div>
              
              <button
                onClick={handleTripComBooking}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Book Hotel on Trip.com</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Find hotels near {nearbyLocation?.name || 'your location'}
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

export default HotelBookingModal;