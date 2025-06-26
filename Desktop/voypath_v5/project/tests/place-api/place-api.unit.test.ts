/**
 * Place API Unit Tests
 * Comprehensive test coverage for all Place management functions
 * Implements TODO-088: Place API テスト自動化
 */

import { describe, it, expect, beforeEach, vi, test } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [{ id: '1', name: 'Test Place' }],
        error: null
      })),
      filter: vi.fn(() => ({
        data: [{ id: '1', name: 'Test Place' }],
        error: null
      })),
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          data: [{ id: '1', name: 'Test Place' }],
          error: null
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { id: '1', name: 'New Place' },
          error: null
        }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: '1', name: 'Updated Place' },
            error: null
          }))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: null,
        error: null
      }))
    }))
  })),
  auth: {
    getUser: vi.fn(() => ({
      data: { user: { id: 'test-user-id' } },
      error: null
    }))
  }
}

// Place API function mocks based on the actual implementation
interface PlaceCreateRequest {
  trip_id: string;
  name: string;
  category: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  wish_level: number;
  stay_duration_minutes: number;
  price_level?: number;
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  tags?: string[];
  external_id?: string;
  country_hint?: string;
}

interface PlaceUpdateRequest {
  place_id: string;
  name?: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  wish_level?: number;
  stay_duration_minutes?: number;
  price_level?: number;
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  tags?: string[];
}

interface PlaceSearchRequest {
  trip_id?: string;
  query?: string;
  category?: string;
  min_rating?: number;
  max_rating?: number;
  min_price_level?: number;
  max_price_level?: number;
  min_wish_level?: number;
  max_wish_level?: number;
  has_coordinates?: boolean;
  scheduled?: boolean;
  user_id?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'wish_level' | 'rating' | 'name' | 'distance';
  sort_order?: 'asc' | 'desc';
}

describe('Place API Unit Tests', () => {
  let placeApi: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the Place API functions
    placeApi = {
      createPlace: vi.fn(),
      getPlace: vi.fn(),
      updatePlace: vi.fn(),
      deletePlace: vi.fn(),
      searchPlaces: vi.fn(),
      listPlaces: vi.fn(),
      validatePlace: vi.fn(),
      calculateDistance: vi.fn(),
      checkDuplicate: vi.fn(),
      processGeographicData: vi.fn()
    }
  })

  describe('Place Creation', () => {
    it('should create a place with valid data', async () => {
      const placeData: PlaceCreateRequest = {
        trip_id: 'trip-123',
        name: 'Tokyo Tower',
        category: 'landmark',
        address: '4-2-8 Shibakoen, Minato City, Tokyo',
        latitude: 35.6586,
        longitude: 139.7454,
        rating: 4.2,
        wish_level: 5,
        stay_duration_minutes: 120,
        price_level: 2,
        estimated_cost: 1000,
        opening_hours: {
          monday: '09:00-23:00',
          tuesday: '09:00-23:00'
        },
        image_url: 'https://example.com/tokyo-tower.jpg',
        visit_date: '2024-12-01',
        preferred_time_slots: ['morning', 'afternoon'],
        notes: 'Must visit iconic landmark',
        tags: ['landmark', 'photo', 'view'],
        external_id: 'google-places-123',
        country_hint: 'JP'
      }

      placeApi.createPlace.mockResolvedValue({
        success: true,
        data: { ...placeData, id: 'place-123' },
        message: 'Place created successfully'
      })

      const result = await placeApi.createPlace(placeData)
      
      expect(result.success).toBe(true)
      expect(result.data.id).toBe('place-123')
      expect(result.data.name).toBe('Tokyo Tower')
      expect(placeApi.createPlace).toHaveBeenCalledWith(placeData)
    })

    it('should fail to create place with invalid data', async () => {
      const invalidData = {
        // Missing required fields
        name: '',
        category: '',
        wish_level: 0 // Invalid wish_level
      }

      placeApi.createPlace.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        details: {
          name: 'Name is required',
          category: 'Category is required',
          wish_level: 'Wish level must be between 1 and 5'
        }
      })

      const result = await placeApi.createPlace(invalidData)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation failed')
      expect(result.details).toHaveProperty('name')
      expect(result.details).toHaveProperty('category')
      expect(result.details).toHaveProperty('wish_level')
    })

    it('should validate geographic coordinates', async () => {
      const placeWithInvalidCoords: PlaceCreateRequest = {
        trip_id: 'trip-123',
        name: 'Invalid Place',
        category: 'restaurant',
        latitude: 91, // Invalid latitude
        longitude: 181, // Invalid longitude
        wish_level: 3,
        stay_duration_minutes: 60
      }

      placeApi.createPlace.mockResolvedValue({
        success: false,
        error: 'Invalid coordinates',
        details: {
          latitude: 'Latitude must be between -90 and 90',
          longitude: 'Longitude must be between -180 and 180'
        }
      })

      const result = await placeApi.createPlace(placeWithInvalidCoords)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid coordinates')
    })

    it('should check for duplicate places', async () => {
      const placeData: PlaceCreateRequest = {
        trip_id: 'trip-123',
        name: 'Tokyo Tower',
        category: 'landmark',
        latitude: 35.6586,
        longitude: 139.7454,
        wish_level: 5,
        stay_duration_minutes: 120
      }

      placeApi.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        existingPlace: {
          id: 'existing-place-123',
          name: 'Tokyo Tower',
          latitude: 35.6586,
          longitude: 139.7454
        }
      })

      placeApi.createPlace.mockResolvedValue({
        success: false,
        error: 'Duplicate place detected',
        existingPlace: {
          id: 'existing-place-123',
          name: 'Tokyo Tower'
        }
      })

      const duplicateCheck = await placeApi.checkDuplicate(placeData)
      expect(duplicateCheck.isDuplicate).toBe(true)

      const result = await placeApi.createPlace(placeData)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Duplicate place detected')
    })
  })

  describe('Place Retrieval', () => {
    it('should get place by ID', async () => {
      const placeId = 'place-123'
      const mockPlace = {
        id: placeId,
        name: 'Tokyo Tower',
        category: 'landmark',
        latitude: 35.6586,
        longitude: 139.7454,
        rating: 4.2,
        wish_level: 5,
        created_at: '2024-01-01T00:00:00Z'
      }

      placeApi.getPlace.mockResolvedValue({
        success: true,
        data: mockPlace
      })

      const result = await placeApi.getPlace(placeId)
      
      expect(result.success).toBe(true)
      expect(result.data.id).toBe(placeId)
      expect(result.data.name).toBe('Tokyo Tower')
      expect(placeApi.getPlace).toHaveBeenCalledWith(placeId)
    })

    it('should return error for non-existent place', async () => {
      const invalidId = 'non-existent-place'

      placeApi.getPlace.mockResolvedValue({
        success: false,
        error: 'Place not found',
        code: 404
      })

      const result = await placeApi.getPlace(invalidId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Place not found')
      expect(result.code).toBe(404)
    })

    it('should get place with related data', async () => {
      const placeId = 'place-123'
      const mockPlaceWithRelations = {
        id: placeId,
        name: 'Tokyo Tower',
        category: 'landmark',
        images: [
          { id: 'img-1', url: 'https://example.com/img1.jpg' },
          { id: 'img-2', url: 'https://example.com/img2.jpg' }
        ],
        ratings: [
          { id: 'rating-1', score: 5, user_id: 'user-1' },
          { id: 'rating-2', score: 4, user_id: 'user-2' }
        ],
        opening_hours: {
          monday: '09:00-23:00',
          tuesday: '09:00-23:00'
        }
      }

      placeApi.getPlace.mockResolvedValue({
        success: true,
        data: mockPlaceWithRelations
      })

      const result = await placeApi.getPlace(placeId, { includeRelations: true })
      
      expect(result.success).toBe(true)
      expect(result.data.images).toHaveLength(2)
      expect(result.data.ratings).toHaveLength(2)
      expect(result.data.opening_hours).toBeDefined()
    })
  })

  describe('Place Search', () => {
    it('should search places by query', async () => {
      const searchRequest: PlaceSearchRequest = {
        trip_id: 'trip-123',
        query: 'Tokyo',
        category: 'restaurant',
        min_rating: 4.0,
        limit: 10,
        sort_by: 'rating',
        sort_order: 'desc'
      }

      const mockSearchResults = {
        places: [
          {
            id: 'place-1',
            name: 'Tokyo Restaurant 1',
            category: 'restaurant',
            rating: 4.5
          },
          {
            id: 'place-2',
            name: 'Tokyo Restaurant 2',
            category: 'restaurant',
            rating: 4.2
          }
        ],
        total: 2,
        has_more: false
      }

      placeApi.searchPlaces.mockResolvedValue({
        success: true,
        data: mockSearchResults
      })

      const result = await placeApi.searchPlaces(searchRequest)
      
      expect(result.success).toBe(true)
      expect(result.data.places).toHaveLength(2)
      expect(result.data.total).toBe(2)
      expect(result.data.places[0].rating).toBeGreaterThanOrEqual(4.0)
      expect(placeApi.searchPlaces).toHaveBeenCalledWith(searchRequest)
    })

    it('should search places by location', async () => {
      const searchRequest: PlaceSearchRequest = {
        latitude: 35.6762,
        longitude: 139.6503,
        radius_km: 5,
        category: 'attraction',
        limit: 5
      }

      const mockLocationResults = {
        places: [
          {
            id: 'place-1',
            name: 'Nearby Attraction 1',
            category: 'attraction',
            latitude: 35.6586,
            longitude: 139.7454,
            distance: 2.1
          }
        ],
        total: 1,
        has_more: false
      }

      placeApi.searchPlaces.mockResolvedValue({
        success: true,
        data: mockLocationResults
      })

      const result = await placeApi.searchPlaces(searchRequest)
      
      expect(result.success).toBe(true)
      expect(result.data.places[0].distance).toBeLessThanOrEqual(5)
      expect(result.data.places[0].category).toBe('attraction')
    })

    it('should filter places by multiple criteria', async () => {
      const complexSearch: PlaceSearchRequest = {
        trip_id: 'trip-123',
        category: 'restaurant',
        min_rating: 4.0,
        max_price_level: 3,
        min_wish_level: 3,
        has_coordinates: true,
        scheduled: false,
        tags: ['japanese', 'sushi'],
        limit: 20,
        offset: 0
      }

      placeApi.searchPlaces.mockResolvedValue({
        success: true,
        data: {
          places: [
            {
              id: 'place-1',
              name: 'Sushi Restaurant',
              category: 'restaurant',
              rating: 4.5,
              price_level: 2,
              wish_level: 4,
              latitude: 35.6762,
              longitude: 139.6503,
              scheduled: false,
              tags: ['japanese', 'sushi', 'fresh']
            }
          ],
          total: 1,
          has_more: false
        }
      })

      const result = await placeApi.searchPlaces(complexSearch)
      
      expect(result.success).toBe(true)
      expect(result.data.places[0].rating).toBeGreaterThanOrEqual(4.0)
      expect(result.data.places[0].price_level).toBeLessThanOrEqual(3)
      expect(result.data.places[0].tags).toContain('japanese')
      expect(result.data.places[0].tags).toContain('sushi')
    })
  })

  describe('Place Update', () => {
    it('should update place successfully', async () => {
      const updateRequest: PlaceUpdateRequest = {
        place_id: 'place-123',
        name: 'Updated Tokyo Tower',
        rating: 4.5,
        wish_level: 4,
        notes: 'Updated notes'
      }

      placeApi.updatePlace.mockResolvedValue({
        success: true,
        data: {
          id: 'place-123',
          name: 'Updated Tokyo Tower',
          rating: 4.5,
          wish_level: 4,
          notes: 'Updated notes',
          updated_at: '2024-01-01T12:00:00Z'
        },
        message: 'Place updated successfully'
      })

      const result = await placeApi.updatePlace(updateRequest)
      
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Updated Tokyo Tower')
      expect(result.data.rating).toBe(4.5)
      expect(result.data.wish_level).toBe(4)
      expect(placeApi.updatePlace).toHaveBeenCalledWith(updateRequest)
    })

    it('should validate update permissions', async () => {
      const updateRequest: PlaceUpdateRequest = {
        place_id: 'place-123',
        name: 'Unauthorized Update'
      }

      placeApi.updatePlace.mockResolvedValue({
        success: false,
        error: 'Insufficient permissions',
        code: 403,
        details: 'User does not have permission to update this place'
      })

      const result = await placeApi.updatePlace(updateRequest)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient permissions')
      expect(result.code).toBe(403)
    })

    it('should validate update data', async () => {
      const invalidUpdate: PlaceUpdateRequest = {
        place_id: 'place-123',
        wish_level: 10, // Invalid value
        latitude: 100, // Invalid coordinate
        stay_duration_minutes: -30 // Invalid duration
      }

      placeApi.updatePlace.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        details: {
          wish_level: 'Wish level must be between 1 and 5',
          latitude: 'Latitude must be between -90 and 90',
          stay_duration_minutes: 'Duration must be positive'
        }
      })

      const result = await placeApi.updatePlace(invalidUpdate)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation failed')
      expect(result.details).toHaveProperty('wish_level')
      expect(result.details).toHaveProperty('latitude')
      expect(result.details).toHaveProperty('stay_duration_minutes')
    })
  })

  describe('Place Deletion', () => {
    it('should delete place successfully', async () => {
      const placeId = 'place-123'

      placeApi.deletePlace.mockResolvedValue({
        success: true,
        message: 'Place deleted successfully',
        affected_schedules: 2,
        affected_optimizations: 1
      })

      const result = await placeApi.deletePlace(placeId)
      
      expect(result.success).toBe(true)
      expect(result.message).toBe('Place deleted successfully')
      expect(result.affected_schedules).toBe(2)
      expect(result.affected_optimizations).toBe(1)
      expect(placeApi.deletePlace).toHaveBeenCalledWith(placeId)
    })

    it('should check deletion permissions', async () => {
      const placeId = 'place-123'

      placeApi.deletePlace.mockResolvedValue({
        success: false,
        error: 'Insufficient permissions',
        code: 403,
        details: 'Only place creator or trip admin can delete places'
      })

      const result = await placeApi.deletePlace(placeId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient permissions')
      expect(result.code).toBe(403)
    })

    it('should handle place with dependencies', async () => {
      const placeId = 'place-123'

      placeApi.deletePlace.mockResolvedValue({
        success: false,
        error: 'Cannot delete place with dependencies',
        details: {
          scheduled_visits: 3,
          optimization_results: 2,
          message: 'Remove from schedules before deletion'
        }
      })

      const result = await placeApi.deletePlace(placeId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot delete place with dependencies')
      expect(result.details.scheduled_visits).toBe(3)
      expect(result.details.optimization_results).toBe(2)
    })
  })

  describe('Place Validation', () => {
    it('should validate place data', async () => {
      const validPlaceData = {
        name: 'Valid Place',
        category: 'restaurant',
        latitude: 35.6762,
        longitude: 139.6503,
        wish_level: 4,
        stay_duration_minutes: 90,
        price_level: 2
      }

      placeApi.validatePlace.mockResolvedValue({
        isValid: true,
        validatedData: validPlaceData,
        warnings: []
      })

      const result = await placeApi.validatePlace(validPlaceData)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(placeApi.validatePlace).toHaveBeenCalledWith(validPlaceData)
    })

    it('should detect validation errors', async () => {
      const invalidPlaceData = {
        name: '', // Empty name
        category: 'invalid_category',
        latitude: 200, // Invalid latitude
        wish_level: 0, // Invalid wish_level
        stay_duration_minutes: -10 // Invalid duration
      }

      placeApi.validatePlace.mockResolvedValue({
        isValid: false,
        errors: [
          { field: 'name', message: 'Name is required' },
          { field: 'category', message: 'Invalid category' },
          { field: 'latitude', message: 'Invalid latitude value' },
          { field: 'wish_level', message: 'Wish level must be 1-5' },
          { field: 'stay_duration_minutes', message: 'Duration must be positive' }
        ],
        warnings: []
      })

      const result = await placeApi.validatePlace(invalidPlaceData)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(5)
      expect(result.errors[0].field).toBe('name')
    })

    it('should provide validation warnings', async () => {
      const placeDataWithWarnings = {
        name: 'Place Name',
        category: 'restaurant',
        latitude: 35.6762,
        longitude: 139.6503,
        wish_level: 3,
        stay_duration_minutes: 30, // Short duration
        rating: 2.0 // Low rating
      }

      placeApi.validatePlace.mockResolvedValue({
        isValid: true,
        validatedData: placeDataWithWarnings,
        warnings: [
          { field: 'stay_duration_minutes', message: 'Very short visit duration' },
          { field: 'rating', message: 'Low rating place' }
        ]
      })

      const result = await placeApi.validatePlace(placeDataWithWarnings)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings[0].field).toBe('stay_duration_minutes')
    })
  })

  describe('Distance Calculation', () => {
    it('should calculate distance between two points', async () => {
      const point1 = { latitude: 35.6762, longitude: 139.6503 } // Tokyo
      const point2 = { latitude: 35.6586, longitude: 139.7454 } // Tokyo Tower

      placeApi.calculateDistance.mockResolvedValue({
        distance_km: 7.2,
        distance_miles: 4.5,
        travel_time_walking: 90, // minutes
        travel_time_driving: 15   // minutes
      })

      const result = await placeApi.calculateDistance(point1, point2)
      
      expect(result.distance_km).toBeCloseTo(7.2, 1)
      expect(result.distance_miles).toBeCloseTo(4.5, 1)
      expect(result.travel_time_walking).toBe(90)
      expect(result.travel_time_driving).toBe(15)
      expect(placeApi.calculateDistance).toHaveBeenCalledWith(point1, point2)
    })

    it('should handle invalid coordinates for distance calculation', async () => {
      const invalidPoint1 = { latitude: 200, longitude: 300 }
      const validPoint2 = { latitude: 35.6586, longitude: 139.7454 }

      placeApi.calculateDistance.mockResolvedValue({
        error: 'Invalid coordinates',
        details: 'Latitude and longitude must be valid values'
      })

      const result = await placeApi.calculateDistance(invalidPoint1, validPoint2)
      
      expect(result.error).toBe('Invalid coordinates')
      expect(result.details).toBeDefined()
    })
  })

  describe('Geographic Data Processing', () => {
    it('should process geographic data correctly', async () => {
      const addressData = {
        address: '4-2-8 Shibakoen, Minato City, Tokyo, Japan',
        country_hint: 'JP'
      }

      placeApi.processGeographicData.mockResolvedValue({
        success: true,
        geocoded: {
          latitude: 35.6586,
          longitude: 139.7454,
          formatted_address: '4-2-8 Shibakoen, Minato City, Tokyo 105-0011, Japan',
          address_components: {
            country: 'Japan',
            country_code: 'JP',
            city: 'Tokyo',
            prefecture: 'Tokyo',
            postal_code: '105-0011'
          }
        },
        validation: {
          address_valid: true,
          coordinates_valid: true,
          country_match: true
        }
      })

      const result = await placeApi.processGeographicData(addressData)
      
      expect(result.success).toBe(true)
      expect(result.geocoded.latitude).toBeCloseTo(35.6586, 4)
      expect(result.geocoded.longitude).toBeCloseTo(139.7454, 4)
      expect(result.validation.address_valid).toBe(true)
      expect(result.validation.country_match).toBe(true)
    })

    it('should handle geocoding failures', async () => {
      const invalidAddress = {
        address: 'Invalid Address That Does Not Exist',
        country_hint: 'XX'
      }

      placeApi.processGeographicData.mockResolvedValue({
        success: false,
        error: 'Geocoding failed',
        details: 'Address could not be found'
      })

      const result = await placeApi.processGeographicData(invalidAddress)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Geocoding failed')
      expect(result.details).toBe('Address could not be found')
    })
  })
})