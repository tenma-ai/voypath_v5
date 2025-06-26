/**
 * Place API Integration Tests
 * Complete Place management flows end-to-end testing
 * Implements TODO-088: Place API テスト自動化
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key'

describe('Place API Integration Tests', () => {
  let supabase: any
  let testUserId: string
  let testTripId: string
  let testPlaceIds: string[] = []

  beforeAll(async () => {
    // Initialize Supabase client for testing
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Create test user
    const { data: user, error: userError } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    })
    
    if (userError) throw userError
    testUserId = user.user.id

    // Create test trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        name: 'Integration Test Trip',
        departure_location: 'Tokyo Station',
        created_by: testUserId,
        is_public: false
      })
      .select()
      .single()
    
    if (tripError) throw tripError
    testTripId = trip.id
  })

  afterAll(async () => {
    // Clean up test data
    if (testPlaceIds.length > 0) {
      await supabase
        .from('places')
        .delete()
        .in('id', testPlaceIds)
    }

    if (testTripId) {
      await supabase
        .from('trips')
        .delete()
        .eq('id', testTripId)
    }

    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId)
    }
  })

  beforeEach(() => {
    testPlaceIds = []
  })

  describe('Complete Place Management Workflow', () => {
    it('should handle full place lifecycle: create -> read -> update -> delete', async () => {
      // 1. Create place
      const createRequest = {
        trip_id: testTripId,
        name: 'Integration Test Place',
        category: 'restaurant',
        address: '1-1-1 Shibuya, Tokyo',
        latitude: 35.6598,
        longitude: 139.7006,
        rating: 4.5,
        wish_level: 4,
        stay_duration_minutes: 90,
        price_level: 2,
        estimated_cost: 3000,
        opening_hours: {
          monday: '11:00-22:00',
          tuesday: '11:00-22:00',
          wednesday: '11:00-22:00',
          thursday: '11:00-22:00',
          friday: '11:00-23:00',
          saturday: '11:00-23:00',
          sunday: '11:00-21:00'
        },
        visit_date: '2024-12-01',
        preferred_time_slots: ['lunch', 'dinner'],
        notes: 'Great ramen place with excellent atmosphere',
        tags: ['ramen', 'japanese', 'popular']
      }

      const createResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'create',
          ...createRequest
        })
      })

      const createResult = await createResponse.json()
      
      expect(createResult.success).toBe(true)
      expect(createResult.data.id).toBeDefined()
      expect(createResult.data.name).toBe('Integration Test Place')
      expect(createResult.data.category).toBe('restaurant')
      
      const placeId = createResult.data.id
      testPlaceIds.push(placeId)

      // 2. Read place
      const getResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=get&place_id=${placeId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const getResult = await getResponse.json()
      
      expect(getResult.success).toBe(true)
      expect(getResult.data.id).toBe(placeId)
      expect(getResult.data.name).toBe('Integration Test Place')
      expect(getResult.data.latitude).toBeCloseTo(35.6598, 4)
      expect(getResult.data.longitude).toBeCloseTo(139.7006, 4)
      expect(getResult.data.tags).toEqual(['ramen', 'japanese', 'popular'])

      // 3. Update place
      const updateRequest = {
        action: 'update',
        place_id: placeId,
        name: 'Updated Integration Test Place',
        rating: 4.8,
        wish_level: 5,
        notes: 'Updated notes: Still an amazing place!',
        tags: ['ramen', 'japanese', 'popular', 'updated']
      }

      const updateResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(updateRequest)
      })

      const updateResult = await updateResponse.json()
      
      expect(updateResult.success).toBe(true)
      expect(updateResult.data.name).toBe('Updated Integration Test Place')
      expect(updateResult.data.rating).toBe(4.8)
      expect(updateResult.data.wish_level).toBe(5)
      expect(updateResult.data.tags).toContain('updated')

      // 4. Verify update by reading again
      const verifyResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=get&place_id=${placeId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const verifyResult = await verifyResponse.json()
      
      expect(verifyResult.success).toBe(true)
      expect(verifyResult.data.name).toBe('Updated Integration Test Place')
      expect(verifyResult.data.rating).toBe(4.8)

      // 5. Delete place
      const deleteResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'delete',
          place_id: placeId
        })
      })

      const deleteResult = await deleteResponse.json()
      
      expect(deleteResult.success).toBe(true)
      expect(deleteResult.message).toContain('deleted')

      // 6. Verify deletion
      const verifyDeleteResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=get&place_id=${placeId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const verifyDeleteResult = await verifyDeleteResponse.json()
      
      expect(verifyDeleteResult.success).toBe(false)
      expect(verifyDeleteResult.error).toContain('not found')

      // Remove from cleanup list since already deleted
      testPlaceIds = testPlaceIds.filter(id => id !== placeId)
    })
  })

  describe('Place Search Integration', () => {
    const searchTestPlaces: string[] = []

    beforeEach(async () => {
      // Create test places for searching
      const testPlaces = [
        {
          name: 'Search Test Restaurant 1',
          category: 'restaurant',
          rating: 4.5,
          wish_level: 5,
          price_level: 2,
          tags: ['japanese', 'sushi']
        },
        {
          name: 'Search Test Cafe 1',
          category: 'cafe',
          rating: 4.0,
          wish_level: 3,
          price_level: 1,
          tags: ['coffee', 'quiet']
        },
        {
          name: 'Search Test Museum 1',
          category: 'attraction',
          rating: 4.8,
          wish_level: 4,
          price_level: 3,
          tags: ['culture', 'art']
        }
      ]

      for (const place of testPlaces) {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'create',
            trip_id: testTripId,
            stay_duration_minutes: 60,
            ...place
          })
        })

        const result = await response.json()
        if (result.success) {
          searchTestPlaces.push(result.data.id)
          testPlaceIds.push(result.data.id)
        }
      }
    })

    it('should search places by category', async () => {
      const searchResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=search&trip_id=${testTripId}&category=restaurant`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const searchResult = await searchResponse.json()
      
      expect(searchResult.success).toBe(true)
      expect(searchResult.data.places.length).toBeGreaterThan(0)
      
      // All results should be restaurants
      searchResult.data.places.forEach((place: any) => {
        expect(place.category).toBe('restaurant')
      })
    })

    it('should search places by rating range', async () => {
      const searchResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=search&trip_id=${testTripId}&min_rating=4.5`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const searchResult = await searchResponse.json()
      
      expect(searchResult.success).toBe(true)
      expect(searchResult.data.places.length).toBeGreaterThan(0)
      
      // All results should have rating >= 4.5
      searchResult.data.places.forEach((place: any) => {
        expect(place.rating).toBeGreaterThanOrEqual(4.5)
      })
    })

    it('should search places by tags', async () => {
      const searchResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=search&trip_id=${testTripId}&tags=japanese,sushi`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const searchResult = await searchResponse.json()
      
      expect(searchResult.success).toBe(true)
      expect(searchResult.data.places.length).toBeGreaterThan(0)
      
      // All results should have the specified tags
      searchResult.data.places.forEach((place: any) => {
        expect(place.tags).toEqual(expect.arrayContaining(['japanese']))
      })
    })

    it('should search with complex filters', async () => {
      const searchParams = new URLSearchParams({
        action: 'search',
        trip_id: testTripId,
        category: 'restaurant',
        min_rating: '4.0',
        max_price_level: '3',
        min_wish_level: '3',
        sort_by: 'rating',
        sort_order: 'desc',
        limit: '10'
      })

      const searchResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const searchResult = await searchResponse.json()
      
      expect(searchResult.success).toBe(true)
      
      if (searchResult.data.places.length > 0) {
        // Verify all filters are applied
        searchResult.data.places.forEach((place: any) => {
          expect(place.category).toBe('restaurant')
          expect(place.rating).toBeGreaterThanOrEqual(4.0)
          expect(place.price_level).toBeLessThanOrEqual(3)
          expect(place.wish_level).toBeGreaterThanOrEqual(3)
        })

        // Verify sorting (rating descending)
        for (let i = 1; i < searchResult.data.places.length; i++) {
          expect(searchResult.data.places[i-1].rating).toBeGreaterThanOrEqual(searchResult.data.places[i].rating)
        }
      }
    })
  })

  describe('Place Validation Integration', () => {
    it('should validate place data before creation', async () => {
      const invalidPlaceData = {
        action: 'create',
        trip_id: testTripId,
        name: '', // Invalid: empty name
        category: 'invalid_category', // Invalid category
        latitude: 200, // Invalid latitude
        longitude: -200, // Invalid longitude
        wish_level: 0, // Invalid wish level
        stay_duration_minutes: -30, // Invalid duration
        price_level: 5 // Invalid price level
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(invalidPlaceData)
      })

      const result = await response.json()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('validation')
      expect(result.details).toBeDefined()
      
      // Should have validation errors for all invalid fields
      expect(Object.keys(result.details)).toContain('name')
      expect(Object.keys(result.details)).toContain('category')
      expect(Object.keys(result.details)).toContain('latitude')
      expect(Object.keys(result.details)).toContain('longitude')
      expect(Object.keys(result.details)).toContain('wish_level')
    })

    it('should validate geographic coordinates', async () => {
      const placeWithInvalidCoords = {
        action: 'create',
        trip_id: testTripId,
        name: 'Valid Name',
        category: 'restaurant',
        latitude: 91, // Invalid: > 90
        longitude: 181, // Invalid: > 180
        wish_level: 3,
        stay_duration_minutes: 60
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(placeWithInvalidCoords)
      })

      const result = await response.json()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('coordinate')
      expect(result.details.latitude).toBeDefined()
      expect(result.details.longitude).toBeDefined()
    })
  })

  describe('Place Image Management Integration', () => {
    let testPlaceId: string

    beforeEach(async () => {
      // Create a test place for image operations
      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'create',
          trip_id: testTripId,
          name: 'Image Test Place',
          category: 'restaurant',
          wish_level: 3,
          stay_duration_minutes: 60
        })
      })

      const result = await response.json()
      testPlaceId = result.data.id
      testPlaceIds.push(testPlaceId)
    })

    it('should upload and manage place images', async () => {
      // Mock base64 image data
      const mockImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

      // Upload image
      const uploadResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'uploadImage',
          place_id: testPlaceId,
          image_data: mockImageData,
          description: 'Test image',
          is_primary: true
        })
      })

      const uploadResult = await uploadResponse.json()
      
      expect(uploadResult.success).toBe(true)
      expect(uploadResult.data.image_id).toBeDefined()
      expect(uploadResult.data.public_url).toBeDefined()
      expect(uploadResult.data.is_primary).toBe(true)

      const imageId = uploadResult.data.image_id

      // Get images for place
      const getImagesResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=getImages&place_id=${testPlaceId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const getImagesResult = await getImagesResponse.json()
      
      expect(getImagesResult.success).toBe(true)
      expect(getImagesResult.data.images.length).toBe(1)
      expect(getImagesResult.data.images[0].id).toBe(imageId)
      expect(getImagesResult.data.images[0].is_primary).toBe(true)

      // Delete image
      const deleteImageResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'deleteImage',
          image_id: imageId
        })
      })

      const deleteImageResult = await deleteImageResponse.json()
      
      expect(deleteImageResult.success).toBe(true)
      expect(deleteImageResult.message).toContain('deleted')
    })
  })

  describe('Place Rating Integration', () => {
    let testPlaceId: string

    beforeEach(async () => {
      // Create a test place for rating operations
      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'create',
          trip_id: testTripId,
          name: 'Rating Test Place',
          category: 'restaurant',
          wish_level: 3,
          stay_duration_minutes: 60
        })
      })

      const result = await response.json()
      testPlaceId = result.data.id
      testPlaceIds.push(testPlaceId)
    })

    it('should manage place ratings', async () => {
      // Add rating
      const addRatingResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'addRating',
          place_id: testPlaceId,
          rating: 4.5,
          comment: 'Excellent place!',
          categories: {
            food_quality: 5,
            service: 4,
            atmosphere: 4,
            value: 4
          }
        })
      })

      const addRatingResult = await addRatingResponse.json()
      
      expect(addRatingResult.success).toBe(true)
      expect(addRatingResult.data.rating_id).toBeDefined()
      expect(addRatingResult.data.overall_rating).toBe(4.5)

      // Get ratings
      const getRatingsResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=getRatings&place_id=${testPlaceId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const getRatingsResult = await getRatingsResponse.json()
      
      expect(getRatingsResult.success).toBe(true)
      expect(getRatingsResult.data.ratings.length).toBe(1)
      expect(getRatingsResult.data.ratings[0].rating).toBe(4.5)
      expect(getRatingsResult.data.ratings[0].comment).toBe('Excellent place!')
      expect(getRatingsResult.data.average_rating).toBe(4.5)
      expect(getRatingsResult.data.total_ratings).toBe(1)

      // Get rating statistics
      const getStatsResponse = await fetch(`${SUPABASE_URL}/functions/v1/place-management?action=getRatingStats&place_id=${testPlaceId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      })

      const getStatsResult = await getStatsResponse.json()
      
      expect(getStatsResult.success).toBe(true)
      expect(getStatsResult.data.average_rating).toBe(4.5)
      expect(getStatsResult.data.total_ratings).toBe(1)
      expect(getStatsResult.data.rating_distribution['5']).toBe(1)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle authentication errors', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No authorization header
        },
        body: JSON.stringify({
          action: 'create',
          trip_id: testTripId,
          name: 'Unauthorized Place',
          category: 'restaurant',
          wish_level: 3,
          stay_duration_minutes: 60
        })
      })

      const result = await response.json()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('authorization')
      expect(response.status).toBe(401)
    })

    it('should handle invalid trip_id', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'create',
          trip_id: 'invalid-trip-id',
          name: 'Test Place',
          category: 'restaurant',
          wish_level: 3,
          stay_duration_minutes: 60
        })
      })

      const result = await response.json()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('trip')
      expect(result.code).toBe(404)
    })

    it('should handle malformed requests', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: '{"invalid": "json"' // Malformed JSON
      })

      const result = await response.json()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('request')
    })
  })
})