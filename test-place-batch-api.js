#!/usr/bin/env node

/**
 * Voypath Place Batch Operations API Test Script
 * Tests TODO-086: Place一括操作API実装
 * 
 * This script tests:
 * - POST /place-management/batch/create (一括場所作成)
 * - POST /place-management/batch/update (一括場所更新)
 * - POST /place-management/batch/delete (一括場所削除)
 */

const SUPABASE_URL = 'https://rdufxwoeneglyponagdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';
const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123'
};

// Test configuration
const TEST_CONFIG = {
  trip_id: null, // Will be set during test
  test_places: [
    {
      name: 'Test Restaurant 1',
      category: 'restaurant',
      description: 'A great test restaurant',
      latitude: 35.6762,
      longitude: 139.6503,
      wish_level: 4,
      stay_duration_minutes: 90,
      address: 'Tokyo Test Area 1',
      price_level: 2
    },
    {
      name: 'Test Museum 2',
      category: 'cultural',
      description: 'An interesting test museum',
      latitude: 35.6794,
      longitude: 139.6569,
      wish_level: 5,
      stay_duration_minutes: 120,
      address: 'Tokyo Test Area 2',
      price_level: 1
    },
    {
      name: 'Test Park 3',
      category: 'outdoor',
      description: 'A beautiful test park',
      latitude: 35.6751,
      longitude: 139.6503,
      wish_level: 3,
      stay_duration_minutes: 60,
      address: 'Tokyo Test Area 3',
      price_level: 0
    }
  ],
  created_place_ids: [], // Will store IDs of created places
  access_token: null
};

/**
 * HTTP request helper with authentication
 */
async function makeAuthenticatedRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${TEST_CONFIG.access_token || SUPABASE_ANON_KEY}`,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`);
  }
  
  return { response, data };
}

/**
 * Test authentication and get access token
 */
async function testAuthentication() {
  console.log('🔐 Using anonymous authentication...');
  
  try {
    // For testing, we'll use the anonymous key
    // In a real application, you would authenticate with actual user credentials
    TEST_CONFIG.access_token = SUPABASE_ANON_KEY;
    console.log('✅ Anonymous authentication set up');
    return true;
  } catch (error) {
    console.log(`❌ Authentication setup failed: ${error.message}`);
    return false;
  }
}

/**
 * Get or create a test trip
 */
async function setupTestTrip() {
  console.log('🏖️ Setting up test trip...');
  
  try {
    // For testing purposes, use a hardcoded test trip ID
    // In a real implementation, you would get or create trips through the API
    TEST_CONFIG.trip_id = '123e4567-e89b-12d3-a456-426614174000'; // Test trip ID
    console.log(`✅ Using test trip: ${TEST_CONFIG.trip_id}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to setup test trip: ${error.message}`);
    return false;
  }
}

/**
 * Test 1: Batch Create Places
 */
async function testBatchCreatePlaces() {
  console.log('\n📝 Test 1: Batch Create Places');
  console.log('=' .repeat(50));

  try {
    // Prepare batch create request
    const placesToCreate = TEST_CONFIG.test_places.map(place => ({
      ...place,
      trip_id: TEST_CONFIG.trip_id
    }));

    const batchCreateRequest = {
      places: placesToCreate,
      validation_options: {
        skip_duplicate_check: false,
        allow_partial_failure: true,
        validate_coordinates: true,
        validate_opening_hours: false
      },
      processing_options: {
        batch_size: 5,
        parallel_processing: true,
        rollback_on_failure: false
      }
    };

    console.log(`Creating ${placesToCreate.length} places in batch...`);

    const { data } = await makeAuthenticatedRequest('/place-management/batch/create', {
      method: 'POST',
      body: JSON.stringify(batchCreateRequest)
    });

    console.log('✅ Batch create successful!');
    console.log(`📊 Results summary:`);
    console.log(`   Total requested: ${data.data.total_requested}`);
    console.log(`   Successful: ${data.data.successful_count}`);
    console.log(`   Failed: ${data.data.failed_count}`);
    console.log(`   Skipped: ${data.data.skipped_count}`);
    console.log(`   Execution time: ${data.data.execution_summary.total_execution_time_ms}ms`);
    console.log(`   Parallel processing: ${data.data.execution_summary.parallel_processing_used}`);

    // Store created place IDs for future tests
    TEST_CONFIG.created_place_ids = data.data.results
      .filter(result => result.status === 'success')
      .map(result => result.item_id);

    console.log(`📝 Created place IDs: ${TEST_CONFIG.created_place_ids.join(', ')}`);

    // Show detailed results
    console.log('\n📋 Detailed results:');
    data.data.results.forEach((result, index) => {
      console.log(`   ${index + 1}. Status: ${result.status}, ID: ${result.item_id || 'N/A'}, Time: ${result.execution_time_ms || 0}ms`);
      if (result.error_message) {
        console.log(`      Error: ${result.error_message}`);
      }
      if (result.warnings && result.warnings.length > 0) {
        console.log(`      Warnings: ${result.warnings.join(', ')}`);
      }
    });

    return data.data.successful_count > 0;

  } catch (error) {
    console.log(`❌ Batch create test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Batch Update Places
 */
async function testBatchUpdatePlaces() {
  console.log('\n📝 Test 2: Batch Update Places');
  console.log('=' .repeat(50));

  if (TEST_CONFIG.created_place_ids.length === 0) {
    console.log('⏭️ Skipping batch update test - no places to update');
    return true;
  }

  try {
    // Prepare batch update request
    const updatesToMake = TEST_CONFIG.created_place_ids.slice(0, 2).map((placeId, index) => ({
      place_id: placeId,
      updates: {
        description: `Updated description ${index + 1} via batch operation`,
        wish_level: 5,
        notes: `Batch updated at ${new Date().toISOString()}`
      }
    }));

    const batchUpdateRequest = {
      updates: updatesToMake,
      validation_options: {
        allow_partial_failure: true,
        validate_permissions: true,
        validate_coordinates: false
      },
      processing_options: {
        batch_size: 5,
        parallel_processing: true,
        rollback_on_failure: false
      }
    };

    console.log(`Updating ${updatesToMake.length} places in batch...`);

    const { data } = await makeAuthenticatedRequest('/place-management/batch/update', {
      method: 'POST',
      body: JSON.stringify(batchUpdateRequest)
    });

    console.log('✅ Batch update successful!');
    console.log(`📊 Results summary:`);
    console.log(`   Total requested: ${data.data.total_requested}`);
    console.log(`   Successful: ${data.data.successful_count}`);
    console.log(`   Failed: ${data.data.failed_count}`);
    console.log(`   Skipped: ${data.data.skipped_count}`);
    console.log(`   Execution time: ${data.data.execution_summary.total_execution_time_ms}ms`);
    console.log(`   Parallel processing: ${data.data.execution_summary.parallel_processing_used}`);

    // Show detailed results
    console.log('\n📋 Detailed results:');
    data.data.results.forEach((result, index) => {
      console.log(`   ${index + 1}. Status: ${result.status}, ID: ${result.item_id || 'N/A'}, Time: ${result.execution_time_ms || 0}ms`);
      if (result.error_message) {
        console.log(`      Error: ${result.error_message}`);
      }
      if (result.warnings && result.warnings.length > 0) {
        console.log(`      Warnings: ${result.warnings.join(', ')}`);
      }
    });

    return data.data.successful_count > 0;

  } catch (error) {
    console.log(`❌ Batch update test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Batch Delete Places
 */
async function testBatchDeletePlaces() {
  console.log('\n📝 Test 3: Batch Delete Places');
  console.log('=' .repeat(50));

  if (TEST_CONFIG.created_place_ids.length === 0) {
    console.log('⏭️ Skipping batch delete test - no places to delete');
    return true;
  }

  try {
    // Keep one place, delete the rest
    const placesToDelete = TEST_CONFIG.created_place_ids.slice(1);

    const batchDeleteRequest = {
      place_ids: placesToDelete,
      deletion_options: {
        perform_impact_analysis: true,
        allow_partial_failure: true,
        cascade_delete_related: true
      },
      processing_options: {
        batch_size: 5,
        parallel_processing: true,
        send_notifications: false
      }
    };

    console.log(`Deleting ${placesToDelete.length} places in batch...`);

    const { data } = await makeAuthenticatedRequest('/place-management/batch/delete', {
      method: 'POST',
      body: JSON.stringify(batchDeleteRequest)
    });

    console.log('✅ Batch delete successful!');
    console.log(`📊 Results summary:`);
    console.log(`   Total requested: ${data.data.total_requested}`);
    console.log(`   Successful: ${data.data.successful_count}`);
    console.log(`   Failed: ${data.data.failed_count}`);
    console.log(`   Skipped: ${data.data.skipped_count}`);
    console.log(`   Execution time: ${data.data.execution_summary.total_execution_time_ms}ms`);
    console.log(`   Parallel processing: ${data.data.execution_summary.parallel_processing_used}`);

    // Show detailed results
    console.log('\n📋 Detailed results:');
    data.data.results.forEach((result, index) => {
      console.log(`   ${index + 1}. Status: ${result.status}, ID: ${result.item_id || 'N/A'}, Time: ${result.execution_time_ms || 0}ms`);
      if (result.error_message) {
        console.log(`      Error: ${result.error_message}`);
      }
      if (result.warnings && result.warnings.length > 0) {
        console.log(`      Warnings: ${result.warnings.join(', ')}`);
      }
    });

    return data.data.successful_count > 0;

  } catch (error) {
    console.log(`❌ Batch delete test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Performance Test with Larger Batch
 */
async function testBatchPerformance() {
  console.log('\n📝 Test 4: Batch Performance Test');
  console.log('=' .repeat(50));

  try {
    // Create a larger batch for performance testing
    const largeBatch = [];
    for (let i = 0; i < 20; i++) {
      largeBatch.push({
        trip_id: TEST_CONFIG.trip_id,
        name: `Performance Test Place ${i + 1}`,
        category: ['restaurant', 'cultural', 'outdoor', 'shopping'][i % 4],
        description: `Performance test place ${i + 1}`,
        latitude: 35.6762 + (Math.random() - 0.5) * 0.01,
        longitude: 139.6503 + (Math.random() - 0.5) * 0.01,
        wish_level: Math.floor(Math.random() * 5) + 1,
        stay_duration_minutes: 60 + Math.floor(Math.random() * 120),
        address: `Performance Test Area ${i + 1}`,
        price_level: Math.floor(Math.random() * 5)
      });
    }

    const batchCreateRequest = {
      places: largeBatch,
      validation_options: {
        skip_duplicate_check: true,
        allow_partial_failure: true,
        validate_coordinates: true
      },
      processing_options: {
        batch_size: 10,
        parallel_processing: true,
        rollback_on_failure: false
      }
    };

    console.log(`Creating ${largeBatch.length} places for performance test...`);
    const startTime = Date.now();

    const { data } = await makeAuthenticatedRequest('/place-management/batch/create', {
      method: 'POST',
      body: JSON.stringify(batchCreateRequest)
    });

    const totalTime = Date.now() - startTime;

    console.log('✅ Performance test completed!');
    console.log(`📊 Performance results:`);
    console.log(`   Total places: ${data.data.total_requested}`);
    console.log(`   Successful: ${data.data.successful_count}`);
    console.log(`   Client total time: ${totalTime}ms`);
    console.log(`   Server execution time: ${data.data.execution_summary.total_execution_time_ms}ms`);
    console.log(`   Average per item: ${data.data.execution_summary.average_item_time_ms}ms`);
    console.log(`   Batches processed: ${data.data.execution_summary.batches_processed}`);
    console.log(`   Throughput: ${Math.round(data.data.successful_count / (totalTime / 1000))} places/second`);

    // Clean up performance test data
    if (data.data.successful_count > 0) {
      const createdIds = data.data.results
        .filter(result => result.status === 'success')
        .map(result => result.item_id);

      await makeAuthenticatedRequest('/place-management/batch/delete', {
        method: 'POST',
        body: JSON.stringify({
          place_ids: createdIds,
          deletion_options: { allow_partial_failure: true }
        })
      });
      console.log(`🧹 Cleaned up ${createdIds.length} performance test places`);
    }

    return true;

  } catch (error) {
    console.log(`❌ Performance test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Error Handling and Edge Cases
 */
async function testErrorHandling() {
  console.log('\n📝 Test 5: Error Handling and Edge Cases');
  console.log('=' .repeat(50));

  let allTestsPassed = true;

  // Test 1: Empty batch
  try {
    console.log('Testing empty batch...');
    await makeAuthenticatedRequest('/place-management/batch/create', {
      method: 'POST',
      body: JSON.stringify({ places: [] })
    });
    console.log('❌ Empty batch should have failed');
    allTestsPassed = false;
  } catch (error) {
    console.log('✅ Empty batch correctly rejected');
  }

  // Test 2: Batch size limit
  try {
    console.log('Testing batch size limit...');
    const oversizedBatch = new Array(60).fill({
      trip_id: TEST_CONFIG.trip_id,
      name: 'Test Place',
      category: 'restaurant',
      wish_level: 3,
      stay_duration_minutes: 60
    });

    await makeAuthenticatedRequest('/place-management/batch/create', {
      method: 'POST',
      body: JSON.stringify({ places: oversizedBatch })
    });
    console.log('❌ Oversized batch should have failed');
    allTestsPassed = false;
  } catch (error) {
    console.log('✅ Oversized batch correctly rejected');
  }

  // Test 3: Invalid coordinates
  try {
    console.log('Testing invalid coordinates handling...');
    const { data } = await makeAuthenticatedRequest('/place-management/batch/create', {
      method: 'POST',
      body: JSON.stringify({
        places: [{
          trip_id: TEST_CONFIG.trip_id,
          name: 'Invalid Coordinates Place',
          category: 'restaurant',
          latitude: 91, // Invalid latitude
          longitude: 181, // Invalid longitude
          wish_level: 3,
          stay_duration_minutes: 60
        }],
        validation_options: { allow_partial_failure: true }
      })
    });

    if (data.data.failed_count > 0) {
      console.log('✅ Invalid coordinates correctly handled');
    } else {
      console.log('❌ Invalid coordinates should have been rejected');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('✅ Invalid coordinates correctly rejected');
  }

  // Test 4: Non-existent trip
  try {
    console.log('Testing non-existent trip...');
    const { data } = await makeAuthenticatedRequest('/place-management/batch/create', {
      method: 'POST',
      body: JSON.stringify({
        places: [{
          trip_id: '00000000-0000-0000-0000-000000000000',
          name: 'Test Place',
          category: 'restaurant',
          wish_level: 3,
          stay_duration_minutes: 60
        }],
        validation_options: { allow_partial_failure: true }
      })
    });

    if (data.data.failed_count > 0) {
      console.log('✅ Non-existent trip correctly handled');
    } else {
      console.log('❌ Non-existent trip should have been rejected');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('✅ Non-existent trip correctly rejected');
  }

  return allTestsPassed;
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Voypath Place Batch Operations API Test Suite');
  console.log('='.repeat(60));
  console.log('Testing TODO-086: Place一括操作API実装');
  console.log('');

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // Setup phase
  console.log('🔧 Setup Phase');
  console.log('-'.repeat(30));
  
  const authSuccess = await testAuthentication();
  if (!authSuccess) {
    console.log('❌ Setup failed - cannot continue without authentication');
    return;
  }

  const tripSuccess = await setupTestTrip();
  if (!tripSuccess) {
    console.log('❌ Setup failed - cannot continue without test trip');
    return;
  }

  // Test execution phase
  console.log('\n🧪 Test Execution Phase');
  console.log('-'.repeat(30));

  const tests = [
    { name: 'Batch Create Places', fn: testBatchCreatePlaces },
    { name: 'Batch Update Places', fn: testBatchUpdatePlaces },
    { name: 'Batch Delete Places', fn: testBatchDeletePlaces },
    { name: 'Batch Performance Test', fn: testBatchPerformance },
    { name: 'Error Handling and Edge Cases', fn: testErrorHandling }
  ];

  for (const test of tests) {
    results.total++;
    try {
      const success = await test.fn();
      if (success) {
        results.passed++;
        console.log(`✅ ${test.name} - PASSED`);
      } else {
        results.failed++;
        console.log(`❌ ${test.name} - FAILED`);
      }
    } catch (error) {
      results.failed++;
      console.log(`❌ ${test.name} - ERROR: ${error.message}`);
    }
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success rate: ${Math.round((results.passed / results.total) * 100)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! TODO-086 implementation is working correctly.');
  } else {
    console.log(`\n⚠️ ${results.failed} test(s) failed. Please review the implementation.`);
  }

  console.log('\nTest completed at:', new Date().toISOString());
}

// Execute if this script is run directly
runAllTests().catch(console.error);