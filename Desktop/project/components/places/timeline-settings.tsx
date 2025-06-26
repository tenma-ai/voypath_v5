'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Settings,
  Clock,
  Eye,
  Palette,
  Grid,
  Calendar,
  Map,
  Volume2,
  Moon,
  Sun,
  RotateCcw
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { CalendarDisplayMode, TimelineZoomLevel } from '@/lib/types/calendar-visualization'

export interface TimelineSettings {
  // Display preferences
  displayMode: CalendarDisplayMode
  zoomLevel: TimelineZoomLevel
  showWeekends: boolean
  compactDays: boolean
  
  // Time preferences
  timeFormat: '12h' | '24h'
  startHour: number
  endHour: number
  showBreaks: boolean
  
  // Visual preferences
  colorScheme: 'auto' | 'light' | 'dark'
  highContrast: boolean
  animationsEnabled: boolean
  fontSize: 'small' | 'medium' | 'large'
  
  // Accessibility
  screenReaderMode: boolean
  keyboardNavigation: boolean
  voiceAnnouncements: boolean
  hapticFeedback: boolean
  
  // Advanced
  showTransportTime: boolean
  showUserPreferences: boolean
  showAccommodation: boolean
  autoSaveEnabled: boolean
}

interface TimelineSettingsProps {
  settings: TimelineSettings
  onSettingsChange: (settings: TimelineSettings) => void
  children?: React.ReactNode
}

const defaultSettings: TimelineSettings = {
  displayMode: 'overview',
  zoomLevel: 'standard',
  showWeekends: true,
  compactDays: false,
  timeFormat: '12h',
  startHour: 9,
  endHour: 18,
  showBreaks: true,
  colorScheme: 'auto',
  highContrast: false,
  animationsEnabled: true,
  fontSize: 'medium',
  screenReaderMode: false,
  keyboardNavigation: true,
  voiceAnnouncements: false,
  hapticFeedback: true,
  showTransportTime: true,
  showUserPreferences: true,
  showAccommodation: true,
  autoSaveEnabled: true
}

export function TimelineSettings({
  settings,
  onSettingsChange,
  children
}: TimelineSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const updateSetting = <K extends keyof TimelineSettings>(
    key: K,
    value: TimelineSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }

  const resetToDefaults = () => {
    onSettingsChange(defaultSettings)
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Timeline Settings
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Timeline Settings
          </SheetTitle>
          <SheetDescription>
            Customize your calendar and timeline view preferences
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Display Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Display
            </h3>

            {/* Display Mode */}
            <div className="space-y-2">
              <Label>View Mode</Label>
              <Select
                value={settings.displayMode}
                onValueChange={(value: CalendarDisplayMode) => updateSetting('displayMode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zoom Level */}
            <div className="space-y-2">
              <Label>Detail Level</Label>
              <Select
                value={settings.zoomLevel}
                onValueChange={(value: TimelineZoomLevel) => updateSetting('zoomLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="expanded">Expanded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-weekends">Show Weekends</Label>
                <Switch
                  id="show-weekends"
                  checked={settings.showWeekends}
                  onCheckedChange={(checked) => updateSetting('showWeekends', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="compact-days">Compact Days</Label>
                <Switch
                  id="compact-days"
                  checked={settings.compactDays}
                  onCheckedChange={(checked) => updateSetting('compactDays', checked)}
                />
              </div>
            </div>
          </div>

          {/* Time Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time
            </h3>

            {/* Time Format */}
            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select
                value={settings.timeFormat}
                onValueChange={(value: '12h' | '24h') => updateSetting('timeFormat', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24 Hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Day Hours */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Start Hour: {settings.startHour}:00</Label>
                <Slider
                  value={[settings.startHour]}
                  onValueChange={([value]) => updateSetting('startHour', value)}
                  min={6}
                  max={12}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>End Hour: {settings.endHour}:00</Label>
                <Slider
                  value={[settings.endHour]}
                  onValueChange={([value]) => updateSetting('endHour', value)}
                  min={16}
                  max={23}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-breaks">Show Breaks</Label>
              <Switch
                id="show-breaks"
                checked={settings.showBreaks}
                onCheckedChange={(checked) => updateSetting('showBreaks', checked)}
              />
            </div>
          </div>

          {/* Visual Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </h3>

            {/* Color Scheme */}
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={settings.colorScheme}
                onValueChange={(value: 'auto' | 'light' | 'dark') => updateSetting('colorScheme', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <Grid className="h-4 w-4" />
                      Auto
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Select
                value={settings.fontSize}
                onValueChange={(value: 'small' | 'medium' | 'large') => updateSetting('fontSize', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Visual Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="high-contrast">High Contrast</Label>
                <Switch
                  id="high-contrast"
                  checked={settings.highContrast}
                  onCheckedChange={(checked) => updateSetting('highContrast', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="animations">Animations</Label>
                <Switch
                  id="animations"
                  checked={settings.animationsEnabled}
                  onCheckedChange={(checked) => updateSetting('animationsEnabled', checked)}
                />
              </div>
            </div>
          </div>

          {/* Accessibility */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Accessibility
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="screen-reader">Screen Reader Mode</Label>
                <Switch
                  id="screen-reader"
                  checked={settings.screenReaderMode}
                  onCheckedChange={(checked) => updateSetting('screenReaderMode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="keyboard-nav">Keyboard Navigation</Label>
                <Switch
                  id="keyboard-nav"
                  checked={settings.keyboardNavigation}
                  onCheckedChange={(checked) => updateSetting('keyboardNavigation', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="voice-announcements">Voice Announcements</Label>
                <Switch
                  id="voice-announcements"
                  checked={settings.voiceAnnouncements}
                  onCheckedChange={(checked) => updateSetting('voiceAnnouncements', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="haptic-feedback">Haptic Feedback</Label>
                <Switch
                  id="haptic-feedback"
                  checked={settings.hapticFeedback}
                  onCheckedChange={(checked) => updateSetting('hapticFeedback', checked)}
                />
              </div>
            </div>
          </div>

          {/* Content Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Map className="h-4 w-4" />
              Content
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="transport-time">Transport Times</Label>
                <Switch
                  id="transport-time"
                  checked={settings.showTransportTime}
                  onCheckedChange={(checked) => updateSetting('showTransportTime', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="user-preferences">User Preferences</Label>
                <Switch
                  id="user-preferences"
                  checked={settings.showUserPreferences}
                  onCheckedChange={(checked) => updateSetting('showUserPreferences', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="accommodation">Accommodation</Label>
                <Switch
                  id="accommodation"
                  checked={settings.showAccommodation}
                  onCheckedChange={(checked) => updateSetting('showAccommodation', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save">Auto Save</Label>
                <Switch
                  id="auto-save"
                  checked={settings.autoSaveEnabled}
                  onCheckedChange={(checked) => updateSetting('autoSaveEnabled', checked)}
                />
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="w-full gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { defaultSettings as defaultTimelineSettings }