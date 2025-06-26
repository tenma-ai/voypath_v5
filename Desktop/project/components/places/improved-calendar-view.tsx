'use client'

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Grid3X3,
  List,
  CalendarDays,
  MapPin,
  Plane
} from 'lucide-react'
import { transparentizeColor } from '@/lib/utils/member-colors'
import { ScrollableArea } from '@/components/layout/responsive-layout'

interface Place {
  id: string
  name: string
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  scheduled_time_end?: string | null
  display_color_hex?: string
  member_contributors?: string[]
  transport_mode?: string
  place_type?: string
}

interface CalendarViewProps {
  places: Place[]
  departureLocation?: string
  arrivalLocation?: string
  tripStartDate?: string
  tripEndDate?: string
  className?: string
  onDayClick?: (date: Date, places: Place[]) => void
}

export function ImprovedCalendarView({
  places,
  departureLocation,
  arrivalLocation,
  tripStartDate,
  tripEndDate,
  className,
  onDayClick
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // グループ化された場所データ
  const placesByDate = useMemo(() => {
    const grouped: Record<string, Place[]> = {}
    
    // 出発地を追加
    if (tripStartDate && departureLocation) {
      grouped[tripStartDate] = [{
        id: 'departure',
        name: departureLocation,
        scheduled_date: tripStartDate,
        place_type: 'departure',
        display_color_hex: '#6B7280'
      }]
    }
    
    // 場所を日付でグループ化
    places.forEach(place => {
      if (place.scheduled_date) {
        const dateKey = place.scheduled_date
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(place)
      }
    })
    
    // 到着地を追加
    if (tripEndDate && arrivalLocation) {
      if (!grouped[tripEndDate]) {
        grouped[tripEndDate] = []
      }
      grouped[tripEndDate].push({
        id: 'arrival',
        name: arrivalLocation,
        scheduled_date: tripEndDate,
        place_type: 'arrival',
        display_color_hex: '#6B7280'
      })
    }
    
    // 各日の場所を時間順にソート
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        if (!a.scheduled_time_start || !b.scheduled_time_start) return 0
        return a.scheduled_time_start.localeCompare(b.scheduled_time_start)
      })
    })
    
    return grouped
  }, [places, tripStartDate, tripEndDate, departureLocation, arrivalLocation])
  
  // カレンダーの日付を取得
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startCalendar = new Date(firstDay)
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay())
    
    const days: Date[] = []
    const current = new Date(startCalendar)
    
    // 6週間分の日付を生成
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }
    }
    
    return days
  }
  
  const calendarDays = getCalendarDays()
  const today = new Date()
  
  // ナビゲーション
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() - 1)
      return newDate
    })
  }
  
  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + 1)
      return newDate
    })
  }
  
  const goToToday = () => {
    setCurrentDate(new Date())
  }
  
  // 日付クリックハンドラー
  const handleDayClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    setSelectedDate(dateString)
    onDayClick?.(date, placesByDate[dateString] || [])
  }
  
  // グリッドビューのセルをレンダリング
  const renderGridCell = (date: Date, index: number) => {
    const dateString = date.toISOString().split('T')[0]
    const dayPlaces = placesByDate[dateString] || []
    const isCurrentMonth = date.getMonth() === currentDate.getMonth()
    const isToday = date.toDateString() === today.toDateString()
    const isSelected = selectedDate === dateString
    
    // 移動や空港表示をフィルタリング（グリッドビューでは非表示）
    const displayPlaces = dayPlaces.filter(place => 
      place.transport_mode !== 'walking' && 
      place.transport_mode !== 'driving' &&
      place.transport_mode !== 'transit' &&
      !place.name.toLowerCase().includes('airport')
    )
    
    return (
      <div
        key={index}
        onClick={() => handleDayClick(date)}
        className={cn(
          "p-2 border rounded-lg cursor-pointer transition-all",
          "min-h-[80px] md:min-h-[100px]",
          !isCurrentMonth && "text-gray-300 bg-gray-50 dark:text-gray-600 dark:bg-gray-800/50",
          isCurrentMonth && "hover:bg-gray-50 dark:hover:bg-gray-800/50",
          isToday && "ring-2 ring-primary",
          isSelected && "bg-primary/10 border-primary",
          "overflow-hidden"
        )}
      >
        <div className="text-sm font-medium mb-1">{date.getDate()}</div>
        
        {/* 場所リスト（名前のみ、メンバーカラー付き） */}
        <div className="space-y-1">
          {displayPlaces.slice(0, 3).map((place, idx) => (
            <div
              key={place.id}
              className="text-xs truncate flex items-center gap-1"
            >
              {place.place_type === 'departure' && (
                <Plane className="h-3 w-3 text-gray-500 rotate-45" />
              )}
              {place.place_type === 'arrival' && (
                <Plane className="h-3 w-3 text-gray-500 -rotate-45" />
              )}
              {!place.place_type && place.display_color_hex && (
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: place.display_color_hex }}
                />
              )}
              <span className="truncate">{place.name}</span>
            </div>
          ))}
          
          {displayPlaces.length > 3 && (
            <div className="text-xs text-muted-foreground">
              +{displayPlaces.length - 3} more
            </div>
          )}
        </div>
      </div>
    )
  }
  
  // リストビューの日をレンダリング
  const renderListDay = (dateString: string, dayPlaces: Place[]) => {
    const date = new Date(dateString)
    const isToday = date.toDateString() === today.toDateString()
    
    return (
      <div key={dateString} className="mb-6">
        <h3 className={cn(
          "text-lg font-semibold mb-3 flex items-center gap-2",
          isToday && "text-primary"
        )}>
          <Calendar className="h-4 w-4" />
          {date.toLocaleDateString('ja-JP', { 
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
          {isToday && <span className="text-sm font-normal">(Today)</span>}
        </h3>
        
        <div className="space-y-2">
          {dayPlaces.map((place, idx) => (
            <div
              key={place.id}
              className={cn(
                "p-3 rounded-lg border",
                "flex items-center justify-between",
                "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                "transition-colors"
              )}
            >
              <div className="flex items-center gap-3">
                {/* アイコン */}
                {place.place_type === 'departure' && (
                  <Plane className="h-4 w-4 text-gray-500 rotate-45" />
                )}
                {place.place_type === 'arrival' && (
                  <Plane className="h-4 w-4 text-gray-500 -rotate-45" />
                )}
                {!place.place_type && <MapPin className="h-4 w-4 text-gray-500" />}
                
                {/* 場所名とメンバーカラー */}
                <div className="flex items-center gap-2">
                  {place.display_color_hex && !place.place_type && (
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: place.display_color_hex }}
                    />
                  )}
                  <span className="font-medium">{place.name}</span>
                </div>
              </div>
              
              {/* 時間 */}
              {place.scheduled_time_start && (
                <span className="text-sm text-muted-foreground">
                  {place.scheduled_time_start}
                  {place.scheduled_time_end && ` - ${place.scheduled_time_end}`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">
            {currentDate.toLocaleDateString('ja-JP', { 
              year: 'numeric',
              month: 'long'
            })}
          </h2>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Today
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* ビュー切り替え */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
      </div>
      
      {/* カレンダー本体 */}
      <ScrollableArea height="600px">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {/* 曜日ヘッダー */}
            {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b"
              >
                {day}
              </div>
            ))}
            
            {/* カレンダーグリッド */}
            {calendarDays.map((date, index) => renderGridCell(date, index))}
          </div>
        ) : (
          <div className="p-4">
            {/* リストビュー */}
            {Object.entries(placesByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dateString, dayPlaces]) => 
                renderListDay(dateString, dayPlaces)
              )}
          </div>
        )}
      </ScrollableArea>
    </div>
  )
}