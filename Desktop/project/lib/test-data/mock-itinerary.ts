// Mock data for testing the Interactive Map Visualization

import type { DetailedItinerary, DestinationVisit, DetailedTransportSegment } from '@/lib/optimization/detailed-route-types'

// Compatibility types for testing
interface TestItinerary {
  tripId: string
  totalDurationHours: number
  totalDistanceKm: number
  fairnessScore: number
  destinationVisits: TestDestinationVisit[]
  transportSegments: TestTransportSegment[]
  optimization: any
  metadata: any
  // Add required DetailedItinerary properties
  startDate: Date
  endDate: Date
  departureLocation: {
    name: string
    address: string
    latitude: number
    longitude: number
  }
  returnLocation: {
    name: string
    address: string
    latitude: number
    longitude: number
  }
  preferences: any
  constraints: any
  summary: any
  validation: any
}

interface TestDestinationVisit {
  destinationId: string
  visitOrder: number
  location: {
    name: string
    address: string
    latitude: number
    longitude: number
    placeId: string
  }
  arrivalTime: string
  departureTime: string
  allocatedHours: number
  wishfulUsers: Array<{
    member: {
      userId: string | null
      sessionId: string | null
      displayName: string
      assignedColor: string
    }
    originalRating: number
    assignedColor: string
  }>
  accommodationSuggestions: any[]
  mealSuggestions: any[]
}

interface TestTransportSegment {
  segmentId: string
  fromLocation: {
    name: string
    address: string
    latitude: number
    longitude: number
    placeId: string
  }
  toLocation: {
    name: string
    address: string
    latitude: number
    longitude: number
    placeId: string
  }
  fromName: string
  toName: string
  transportMode: 'walking' | 'driving' | 'flying'
  distanceKm: number
  estimatedTimeHours: number
  departureTime: string
  arrivalTime: string
}

export const mockItinerary: TestItinerary = {
  tripId: 'test-trip-1',
  totalDurationHours: 72,
  totalDistanceKm: 450,
  fairnessScore: 0.85,
  destinationVisits: [
    {
      destinationId: 'dest-1',
      visitOrder: 1,
      location: {
        name: 'Senso-ji Temple',
        address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan',
        latitude: 35.7148,
        longitude: 139.7967,
        placeId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw'
      },
      arrivalTime: '2024-03-15T09:00:00Z',
      departureTime: '2024-03-15T11:30:00Z',
      allocatedHours: 2.5,
      wishfulUsers: [
        {
          member: {
            userId: 'user-1',
            sessionId: null,
            displayName: 'Alice',
            assignedColor: '#FF5733'
          },
          originalRating: 5,
          assignedColor: '#FF5733'
        },
        {
          member: {
            userId: 'user-2', 
            sessionId: null,
            displayName: 'Bob',
            assignedColor: '#3498DB'
          },
          originalRating: 4,
          assignedColor: '#3498DB'
        }
      ],
      accommodationSuggestions: [],
      mealSuggestions: []
    },
    {
      destinationId: 'dest-2',
      visitOrder: 2,
      location: {
        name: 'Tokyo Skytree',
        address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045, Japan',
        latitude: 35.7101,
        longitude: 139.8107,
        placeId: 'ChIJ3z5kuMCPGGARREoXtRrH1Mo'
      },
      arrivalTime: '2024-03-15T13:00:00Z',
      departureTime: '2024-03-15T16:00:00Z',
      allocatedHours: 3,
      wishfulUsers: [
        {
          member: {
            userId: 'user-1',
            sessionId: null,
            displayName: 'Alice',
            assignedColor: '#FF5733'
          },
          originalRating: 4,
          assignedColor: '#FF5733'
        },
        {
          member: {
            userId: 'user-2',
            sessionId: null,
            displayName: 'Bob',
            assignedColor: '#3498DB'
          },
          originalRating: 5,
          assignedColor: '#3498DB'
        },
        {
          member: {
            userId: 'user-3',
            sessionId: null,
            displayName: 'Charlie',
            assignedColor: '#2ECC71'
          },
          originalRating: 4,
          assignedColor: '#2ECC71'
        }
      ],
      accommodationSuggestions: [],
      mealSuggestions: []
    },
    {
      destinationId: 'dest-3',
      visitOrder: 3,
      location: {
        name: 'Shibuya Crossing',
        address: 'Shibuya City, Tokyo, Japan',
        latitude: 35.6598,
        longitude: 139.7006,
        placeId: 'ChIJ69Pk6jKLGGARzDqTgcWEgAA'
      },
      arrivalTime: '2024-03-15T18:00:00Z',
      departureTime: '2024-03-15T20:00:00Z',
      allocatedHours: 2,
      wishfulUsers: [
        {
          member: {
            userId: 'user-1',
            sessionId: null,
            displayName: 'Alice',
            assignedColor: '#FF5733'
          },
          originalRating: 3,
          assignedColor: '#FF5733'
        },
        {
          member: {
            userId: 'user-2',
            sessionId: null,
            displayName: 'Bob',
            assignedColor: '#3498DB'
          },
          originalRating: 3,
          assignedColor: '#3498DB'
        },
        {
          member: {
            userId: 'user-3',
            sessionId: null,
            displayName: 'Charlie',
            assignedColor: '#2ECC71'
          },
          originalRating: 5,
          assignedColor: '#2ECC71'
        },
        {
          member: {
            userId: 'user-4',
            sessionId: null,
            displayName: 'Diana',
            assignedColor: '#F39C12'
          },
          originalRating: 4,
          assignedColor: '#F39C12'
        },
        {
          member: {
            userId: 'user-5',
            sessionId: null,
            displayName: 'Eve',
            assignedColor: '#9B59B6'
          },
          originalRating: 5,
          assignedColor: '#9B59B6'
        }
      ],
      accommodationSuggestions: [],
      mealSuggestions: []
    },
    {
      destinationId: 'dest-4',
      visitOrder: 4,
      location: {
        name: 'Imperial Palace East Gardens',
        address: '1-1 Chiyoda, Chiyoda City, Tokyo 100-8111, Japan',
        latitude: 35.6852,
        longitude: 139.7528,
        placeId: 'ChIJGZKPv7KMGGARfKXr2VgE7vo'
      },
      arrivalTime: '2024-03-16T10:00:00Z',
      departureTime: '2024-03-16T13:00:00Z',
      allocatedHours: 3,
      wishfulUsers: [
        {
          member: {
            userId: 'user-3',
            sessionId: null,
            displayName: 'Charlie',
            assignedColor: '#2ECC71'
          },
          originalRating: 5,
          assignedColor: '#2ECC71'
        }
      ],
      accommodationSuggestions: [],
      mealSuggestions: []
    }
  ],
  transportSegments: [
    {
      segmentId: 'transport-1',
      fromLocation: {
        name: 'Senso-ji Temple',
        address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan',
        latitude: 35.7148,
        longitude: 139.7967,
        placeId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw'
      },
      toLocation: {
        name: 'Tokyo Skytree',
        address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045, Japan',
        latitude: 35.7101,
        longitude: 139.8107,
        placeId: 'ChIJ3z5kuMCPGGARREoXtRrH1Mo'
      },
      fromName: 'Senso-ji Temple',
      toName: 'Tokyo Skytree',
      transportMode: 'walking',
      distanceKm: 1.2,
      estimatedTimeHours: 0.25,
      departureTime: '2024-03-15T11:30:00Z',
      arrivalTime: '2024-03-15T12:45:00Z'
    },
    {
      segmentId: 'transport-2',
      fromLocation: {
        name: 'Tokyo Skytree',
        address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045, Japan',
        latitude: 35.7101,
        longitude: 139.8107,
        placeId: 'ChIJ3z5kuMCPGGARREoXtRrH1Mo'
      },
      toLocation: {
        name: 'Shibuya Crossing',
        address: 'Shibuya City, Tokyo, Japan',
        latitude: 35.6598,
        longitude: 139.7006,
        placeId: 'ChIJ69Pk6jKLGGARzDqTgcWEgAA'
      },
      fromName: 'Tokyo Skytree',
      toName: 'Shibuya Crossing',
      transportMode: 'driving',
      distanceKm: 8.5,
      estimatedTimeHours: 0.5,
      departureTime: '2024-03-15T16:00:00Z',
      arrivalTime: '2024-03-15T16:30:00Z'
    },
    {
      segmentId: 'transport-3',
      fromLocation: {
        name: 'Shibuya Crossing',
        address: 'Shibuya City, Tokyo, Japan',
        latitude: 35.6598,
        longitude: 139.7006,
        placeId: 'ChIJ69Pk6jKLGGARzDqTgcWEgAA'
      },
      toLocation: {
        name: 'Imperial Palace East Gardens',
        address: '1-1 Chiyoda, Chiyoda City, Tokyo 100-8111, Japan',
        latitude: 35.6852,
        longitude: 139.7528,
        placeId: 'ChIJGZKPv7KMGGARfKXr2VgE7vo'
      },
      fromName: 'Shibuya Crossing',
      toName: 'Imperial Palace East Gardens',
      transportMode: 'driving',
      distanceKm: 4.2,
      estimatedTimeHours: 0.33,
      departureTime: '2024-03-16T09:30:00Z',
      arrivalTime: '2024-03-16T10:00:00Z'
    }
  ],
  optimization: {
    algorithmUsed: 'hybrid-genetic-tsp',
    iterations: 1000,
    executionTimeMs: 2500,
    convergenceAchieved: true
  },
  metadata: {
    generatedAt: '2024-03-14T10:00:00Z',
    version: '1.0',
    parameters: {
      fairnessWeight: 0.7,
      efficiencyWeight: 0.3,
      maxDurationHours: 8,
      minDurationHours: 1
    }
  },
  // Add required DetailedItinerary properties
  startDate: new Date('2024-03-15'),
  endDate: new Date('2024-03-17'),
  departureLocation: {
    name: 'Tokyo Station',
    address: '1 Chome Marunouchi, Chiyoda City, Tokyo 100-0005, Japan',
    latitude: 35.6812,
    longitude: 139.7671
  },
  returnLocation: {
    name: 'Tokyo Station',
    address: '1 Chome Marunouchi, Chiyoda City, Tokyo 100-0005, Japan',
    latitude: 35.6812,
    longitude: 139.7671
  },
  preferences: {
    transportModes: ['walking', 'driving'],
    mealPreferences: [],
    accommodationType: 'hotel'
  },
  constraints: {
    maxDailyDistance: 50,
    maxDailyDuration: 12,
    budgetLimit: null
  },
  summary: {
    totalDestinations: 4,
    totalDistance: 450,
    totalDuration: 72,
    averageRating: 4.5,
    transportBreakdown: {
      walking: 30,
      driving: 15,
      total: 45
    }
  },
  validation: {
    isValid: true,
    warnings: [],
    errors: [],
    score: 0.95
  }
}

// Mock multi-day itinerary
export const mockMultiDayItinerary = {
  tripId: 'test-trip-1',
  totalDays: 2,
  dailySchedules: [
    {
      day: 1,
      date: '2024-03-15',
      activities: [
        {
          type: 'destination' as const,
          time: '09:00',
          visitDetails: mockItinerary.destinationVisits[0]
        },
        {
          type: 'transport' as const,
          time: '11:30',
          transportDetails: mockItinerary.transportSegments[0]
        },
        {
          type: 'destination' as const,
          time: '13:00',
          visitDetails: mockItinerary.destinationVisits[1]
        },
        {
          type: 'transport' as const,
          time: '16:00',
          transportDetails: mockItinerary.transportSegments[1]
        },
        {
          type: 'destination' as const,
          time: '18:00',
          visitDetails: mockItinerary.destinationVisits[2]
        }
      ]
    },
    {
      day: 2,
      date: '2024-03-16',
      activities: [
        {
          type: 'transport' as const,
          time: '09:30',
          transportDetails: mockItinerary.transportSegments[2]
        },
        {
          type: 'destination' as const,
          time: '10:00',
          visitDetails: mockItinerary.destinationVisits[3]
        }
      ]
    }
  ]
}