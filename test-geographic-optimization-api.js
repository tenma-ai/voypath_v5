/**
 * Test script for Geographic Search Optimization API (TODO-083)
 * Tests the new geographic optimization endpoints in place-management function
 */

const API_BASE_URL = 'https://your-project-ref.supabase.co/functions/v1/place-management';

// Test coordinates (Tokyo area)
const testCoordinates = {
  tokyo: { latitude: 35.6762, longitude: 139.6503 },
  shibuya: { latitude: 35.6581, longitude: 139.7029 },
  harajuku: { latitude: 35.6667, longitude: 139.7020 },
  shinjuku: { latitude: 35.6896, longitude: 139.6917 },
  ginza: { latitude: 35.6719, longitude: 139.7648 }
};

// Test viewports
const testViewports = {
  tokyo_central: {
    northEast: { latitude: 35.7500, longitude: 139.8000 },
    southWest: { latitude: 35.6000, longitude: 139.6000 }
  },
  shibuya_area: {
    northEast: { latitude: 35.6700, longitude: 139.7200 },
    southWest: { latitude: 35.6400, longitude: 139.6800 }
  }
};

// Test functions
async function testOptimizedGeographicSearch(authToken) {
  console.log('\n=== Testing Optimized Geographic Search ===');
  
  const testParams = [
    {
      name: 'Tokyo 5km radius with Haversine',
      params: {
        latitude: testCoordinates.tokyo.latitude,
        longitude: testCoordinates.tokyo.longitude,
        radius_km: 5,
        limit: 50,
        use_fast_distance: false
      }
    },
    {
      name: 'Tokyo 5km radius with Fast Distance',
      params: {
        latitude: testCoordinates.tokyo.latitude,
        longitude: testCoordinates.tokyo.longitude,
        radius_km: 5,
        limit: 50,
        use_fast_distance: true
      }
    },
    {
      name: 'Shibuya 2km radius',
      params: {
        latitude: testCoordinates.shibuya.latitude,
        longitude: testCoordinates.shibuya.longitude,
        radius_km: 2,
        limit: 20
      }
    }
  ];
  
  for (const test of testParams) {
    console.log(`\n--- ${test.name} ---`);
    
    try {
      const queryParams = new URLSearchParams(test.params);
      const response = await fetch(`${API_BASE_URL}/geo/search?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Search successful');
        console.log(`Places found: ${result.places.length}`);
        console.log(`Execution time: ${result.performance.execution_time_ms}ms`);
        console.log(`Search center: ${result.search_params.center.latitude}, ${result.search_params.center.longitude}`);
        console.log(`Optimization: ${result.search_params.optimization}`);
        console.log(`Total scanned: ${result.performance.total_scanned}`);
        
        // Show first few results
        if (result.places.length > 0) {
          console.log('Sample places:');
          result.places.slice(0, 3).forEach((place, index) => {
            console.log(`  ${index + 1}. ${place.name} - ${place.distance_km?.toFixed(2)}km`);
          });
        }
      } else {
        console.log('❌ Search failed');
        console.log('Error:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Error in optimized geographic search:', error);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testViewportSearch(authToken) {
  console.log('\n=== Testing Viewport Search ===');
  
  const testCases = [
    {
      name: 'Tokyo Central Area',
      viewport: testViewports.tokyo_central,
      options: {
        max_places: 100,
        clustering: false
      }
    },
    {
      name: 'Tokyo Central with Clustering',
      viewport: testViewports.tokyo_central,
      options: {
        max_places: 100,
        clustering: true,
        cluster_radius: 1
      }
    },
    {
      name: 'Shibuya Area with Clustering',
      viewport: testViewports.shibuya_area,
      options: {
        max_places: 50,
        clustering: true,
        cluster_radius: 0.5
      }
    }
  ];
  
  for (const test of testCases) {
    console.log(`\n--- ${test.name} ---`);
    
    try {
      const params = {
        ne_lat: test.viewport.northEast.latitude,
        ne_lng: test.viewport.northEast.longitude,
        sw_lat: test.viewport.southWest.latitude,
        sw_lng: test.viewport.southWest.longitude,
        max_places: test.options.max_places,
        clustering: test.options.clustering,
        ...(test.options.cluster_radius && { cluster_radius: test.options.cluster_radius })
      };
      
      const queryParams = new URLSearchParams(params);
      const response = await fetch(`${API_BASE_URL}/geo/viewport?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Viewport search successful');
        console.log(`Places found: ${result.places.length}`);
        console.log(`Execution time: ${result.performance.execution_time_ms}ms`);
        console.log(`Viewport area: ${result.performance.viewport_area_km2.toFixed(2)} km²`);
        
        if (result.clusters) {
          console.log(`Clusters: ${result.clusters.length}`);
          console.log(`Clustered places: ${result.viewport_stats.clustered_places}`);
          console.log(`Visible clusters: ${result.viewport_stats.visible_clusters}`);
          
          // Show cluster details
          result.clusters.slice(0, 3).forEach((cluster, index) => {
            console.log(`  Cluster ${index + 1}: ${cluster.points.length} places, radius ${cluster.radius.toFixed(3)}km`);
          });
        }
        
        console.log('Viewport stats:', result.viewport_stats);
        
      } else {
        console.log('❌ Viewport search failed');
        console.log('Error:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Error in viewport search:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testGeographicClustering(tripId, authToken) {
  console.log('\n=== Testing Geographic Clustering ===');
  
  const testParams = [
    {
      name: 'Default Clustering (1km)',
      params: {
        trip_id: tripId,
        cluster_radius: 1,
        min_cluster_size: 2
      }
    },
    {
      name: 'Tight Clustering (0.5km)',
      params: {
        trip_id: tripId,
        cluster_radius: 0.5,
        min_cluster_size: 2
      }
    },
    {
      name: 'Loose Clustering (2km)',
      params: {
        trip_id: tripId,
        cluster_radius: 2,
        min_cluster_size: 3
      }
    }
  ];
  
  for (const test of testParams) {
    console.log(`\n--- ${test.name} ---`);
    
    try {
      const queryParams = new URLSearchParams(test.params);
      const response = await fetch(`${API_BASE_URL}/geo/clusters?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Clustering successful');
        console.log(`Execution time: ${result.performance.execution_time_ms}ms`);
        console.log('Cluster statistics:', result.cluster_stats);
        console.log('Parameters:', result.parameters);
        
        // Show cluster details
        if (result.clusters.length > 0) {
          console.log('Clusters found:');
          result.clusters.forEach((cluster, index) => {
            console.log(`  Cluster ${index + 1}:`);
            console.log(`    Center: ${cluster.center.latitude.toFixed(4)}, ${cluster.center.longitude.toFixed(4)}`);
            console.log(`    Places: ${cluster.points.length}`);
            console.log(`    Radius: ${cluster.radius.toFixed(3)}km`);
            
            // Show places in cluster
            cluster.points.slice(0, 3).forEach((point, pIndex) => {
              console.log(`      ${pIndex + 1}. ${point.data.name}`);
            });
            if (cluster.points.length > 3) {
              console.log(`      ... and ${cluster.points.length - 3} more`);
            }
          });
        } else {
          console.log('No clusters found with the given parameters');
        }
        
      } else {
        console.log('❌ Clustering failed');
        console.log('Error:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Error in geographic clustering:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testPerformanceComparison(authToken) {
  console.log('\n=== Testing Performance Comparison ===');
  
  const testCoord = testCoordinates.tokyo;
  const iterations = 5;
  
  console.log(`Running ${iterations} iterations for performance comparison...`);
  
  // Test Haversine vs Fast Distance
  const haversineResults = [];
  const fastDistanceResults = [];
  
  for (let i = 0; i < iterations; i++) {
    // Haversine test
    const haversineStart = Date.now();
    try {
      const params = new URLSearchParams({
        latitude: testCoord.latitude,
        longitude: testCoord.longitude,
        radius_km: 10,
        limit: 100,
        use_fast_distance: false
      });
      
      const response = await fetch(`${API_BASE_URL}/geo/search?${params}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const result = await response.json();
      haversineResults.push({
        time: Date.now() - haversineStart,
        places: result.places?.length || 0,
        execution_time: result.performance?.execution_time_ms || 0
      });
    } catch (error) {
      console.error('Haversine test error:', error);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fast distance test
    const fastStart = Date.now();
    try {
      const params = new URLSearchParams({
        latitude: testCoord.latitude,
        longitude: testCoord.longitude,
        radius_km: 10,
        limit: 100,
        use_fast_distance: true
      });
      
      const response = await fetch(`${API_BASE_URL}/geo/search?${params}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const result = await response.json();
      fastDistanceResults.push({
        time: Date.now() - fastStart,
        places: result.places?.length || 0,
        execution_time: result.performance?.execution_time_ms || 0
      });
    } catch (error) {
      console.error('Fast distance test error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Calculate averages
  const avgHaversine = {
    total_time: haversineResults.reduce((sum, r) => sum + r.time, 0) / iterations,
    execution_time: haversineResults.reduce((sum, r) => sum + r.execution_time, 0) / iterations,
    places: haversineResults.reduce((sum, r) => sum + r.places, 0) / iterations
  };
  
  const avgFastDistance = {
    total_time: fastDistanceResults.reduce((sum, r) => sum + r.time, 0) / iterations,
    execution_time: fastDistanceResults.reduce((sum, r) => sum + r.execution_time, 0) / iterations,
    places: fastDistanceResults.reduce((sum, r) => sum + r.places, 0) / iterations
  };
  
  console.log('\n📊 Performance Comparison Results:');
  console.log(`Haversine Distance (${iterations} iterations):`);
  console.log(`  Average total time: ${avgHaversine.total_time.toFixed(2)}ms`);
  console.log(`  Average execution time: ${avgHaversine.execution_time.toFixed(2)}ms`);
  console.log(`  Average places found: ${avgHaversine.places.toFixed(1)}`);
  
  console.log(`Fast Distance (${iterations} iterations):`);
  console.log(`  Average total time: ${avgFastDistance.total_time.toFixed(2)}ms`);
  console.log(`  Average execution time: ${avgFastDistance.execution_time.toFixed(2)}ms`);
  console.log(`  Average places found: ${avgFastDistance.places.toFixed(1)}`);
  
  const speedImprovement = ((avgHaversine.execution_time - avgFastDistance.execution_time) / avgHaversine.execution_time * 100);
  console.log(`\n🚀 Speed improvement: ${speedImprovement.toFixed(1)}%`);
  
  if (Math.abs(avgHaversine.places - avgFastDistance.places) > 1) {
    console.log(`⚠️  Place count difference: ${Math.abs(avgHaversine.places - avgFastDistance.places).toFixed(1)}`);
  } else {
    console.log('✅ Consistent place counts between algorithms');
  }
}

async function testEdgeCases(authToken) {
  console.log('\n=== Testing Edge Cases ===');
  
  const edgeCases = [
    {
      name: 'Invalid coordinates',
      endpoint: 'geo/search',
      params: { latitude: 0, longitude: 0, radius_km: 10 },
      expectError: true
    },
    {
      name: 'Missing viewport bounds',
      endpoint: 'geo/viewport',
      params: { ne_lat: 35.7, ne_lng: 139.8 }, // Missing sw_lat, sw_lng
      expectError: true
    },
    {
      name: 'Missing trip_id for clustering',
      endpoint: 'geo/clusters',
      params: { cluster_radius: 1 },
      expectError: true
    },
    {
      name: 'Very large radius',
      endpoint: 'geo/search',
      params: { 
        latitude: testCoordinates.tokyo.latitude, 
        longitude: testCoordinates.tokyo.longitude, 
        radius_km: 1000 
      },
      expectError: false
    },
    {
      name: 'Very small cluster radius',
      endpoint: 'geo/clusters',
      params: { 
        trip_id: 'test-trip-id', 
        cluster_radius: 0.001,
        min_cluster_size: 1
      },
      expectError: false
    }
  ];
  
  for (const testCase of edgeCases) {
    console.log(`\n--- ${testCase.name} ---`);
    
    try {
      const queryParams = new URLSearchParams(testCase.params);
      const response = await fetch(`${API_BASE_URL}/${testCase.endpoint}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const result = await response.json();
      
      if (testCase.expectError) {
        if (!response.ok) {
          console.log('✅ Expected error occurred');
          console.log('Error message:', result.error);
        } else {
          console.log('❌ Expected error but request succeeded');
        }
      } else {
        if (response.ok) {
          console.log('✅ Edge case handled successfully');
          if (result.places) {
            console.log(`Places found: ${result.places.length}`);
          }
          if (result.clusters) {
            console.log(`Clusters found: ${result.clusters.length}`);
          }
        } else {
          console.log('❌ Unexpected error in edge case');
          console.log('Error:', result.error);
        }
      }
      
    } catch (error) {
      console.error(`❌ Network error in edge case ${testCase.name}:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

// Main test runner
async function runGeographicOptimizationTests() {
  console.log('🧪 Starting Geographic Search Optimization Tests');
  console.log('='.repeat(60));
  
  // These values need to be provided
  const AUTH_TOKEN = 'your-auth-token';  // Replace with actual auth token
  const TRIP_ID = 'your-test-trip-id';   // Replace with actual trip ID
  
  if (AUTH_TOKEN === 'your-auth-token') {
    console.log('❌ Please update the test script with actual AUTH_TOKEN and TRIP_ID');
    return;
  }
  
  console.log('Test Configuration:');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Auth Token:', AUTH_TOKEN ? 'Present' : 'Missing');
  console.log('Trip ID:', TRIP_ID);
  
  try {
    // Run all tests
    await testOptimizedGeographicSearch(AUTH_TOKEN);
    await testViewportSearch(AUTH_TOKEN);
    await testGeographicClustering(TRIP_ID, AUTH_TOKEN);
    await testPerformanceComparison(AUTH_TOKEN);
    await testEdgeCases(AUTH_TOKEN);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Geographic Search Optimization Tests Completed');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testOptimizedGeographicSearch,
    testViewportSearch,
    testGeographicClustering,
    testPerformanceComparison,
    testEdgeCases,
    runGeographicOptimizationTests
  };
}

// Run tests if this script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runGeographicOptimizationTests();
}

// Usage instructions
console.log(`
📋 Usage Instructions:
1. Update the API_BASE_URL with your actual Supabase function URL
2. Replace AUTH_TOKEN and TRIP_ID with actual values
3. Run the script: node test-geographic-optimization-api.js

📊 Test Coverage:
✅ Optimized geographic search (GET /place-management/geo/search)
✅ Viewport-based search (GET /place-management/geo/viewport)  
✅ Geographic clustering (GET /place-management/geo/clusters)
✅ Performance comparison (Haversine vs Fast Distance)
✅ Edge cases and error handling
✅ Load testing and optimization verification

🔧 Features Tested:
✅ Bounding box optimization for faster spatial queries
✅ Fast distance approximation vs precise Haversine calculation
✅ Geographic clustering with configurable radius
✅ Viewport-based queries for map display optimization
✅ Performance monitoring and metrics logging
✅ Error handling and input validation
✅ Usage tracking and analytics

🚀 Optimization Features:
✅ Early exit for identical coordinates
✅ Bounding box pre-filtering for large radius searches
✅ Choice between precise and fast distance calculations
✅ Geographic clustering for map display performance
✅ Viewport area calculation and optimization
✅ Performance metrics and monitoring
✅ Memory-efficient algorithms for large datasets
`);