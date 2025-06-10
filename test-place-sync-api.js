// Test Place Data Synchronization API
// This script tests all place data synchronization endpoints

const SUPABASE_URL = 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const API_URL = `${SUPABASE_URL}/functions/v1/place-management`;

// Test configuration
const TEST_CONFIG = {
  // Test user authentication
  authToken: 'your-auth-token', // Replace with actual JWT token
  
  // Test trip ID
  tripId: 'test-trip-uuid', // Replace with actual trip ID
  
  // Test place ID  
  placeId: 'test-place-uuid' // Replace with actual place ID
};

// Test data synchronization status
async function testGetSyncStatus() {
  console.log('\n=== Testing Place Sync Status API ===');
  
  try {
    const response = await fetch(`${API_URL}/sync/status?trip_id=${TEST_CONFIG.tripId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('✅ Sync status retrieved successfully');
      console.log(`📊 Status: ${result.data.status}`);
      console.log(`📝 Places: ${result.data.places_count}`);
      console.log(`⏳ Pending: ${result.data.pending_changes}`);
      console.log(`⚠️ Conflicts: ${result.data.conflicts_count}`);
      return result.data;
    } else {
      console.log('❌ Failed to get sync status');
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing sync status:', error.message);
    return null;
  }
}

// Test data integrity check
async function testDataIntegrityCheck() {
  console.log('\n=== Testing Data Integrity Check API ===');
  
  try {
    const response = await fetch(`${API_URL}/sync/integrity?trip_id=${TEST_CONFIG.tripId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('✅ Data integrity check completed');
      console.log(`📊 Score: ${result.data.integrity_score}%`);
      console.log(`🎯 Status: ${result.data.overall_status}`);
      
      if (result.data.checks) {
        result.data.checks.forEach(check => {
          const status = check.passed ? '✅' : '❌';
          console.log(`${status} ${check.check_type}: ${check.details}`);
        });
      }
      return result.data;
    } else {
      console.log('❌ Failed to check data integrity');
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing data integrity:', error.message);
    return null;
  }
}

// Test sync conflict detection
async function testSyncConflictDetection() {
  console.log('\n=== Testing Sync Conflict Detection API ===');
  
  try {
    const response = await fetch(`${API_URL}/sync/conflicts?trip_id=${TEST_CONFIG.tripId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('✅ Conflict detection completed');
      console.log(`📊 Total conflicts: ${result.data.total_conflicts}`);
      console.log(`🆕 New conflicts: ${result.data.new_conflicts.length}`);
      console.log(`📝 Existing conflicts: ${result.data.existing_conflicts.length}`);
      console.log(`⚠️ Requires resolution: ${result.data.requires_resolution}`);
      return result.data;
    } else {
      console.log('❌ Failed to detect conflicts');
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing conflict detection:', error.message);
    return null;
  }
}

// Test sync statistics
async function testSyncStatistics() {
  console.log('\n=== Testing Sync Statistics API ===');
  
  const timeRanges = ['1h', '24h', '7d', '30d'];
  
  for (const timeRange of timeRanges) {
    try {
      const response = await fetch(`${API_URL}/sync/stats?trip_id=${TEST_CONFIG.tripId}&time_range=${timeRange}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      console.log(`\n📊 Stats for ${timeRange}:`);
      console.log('Status:', response.status);

      if (result.success && result.data) {
        console.log('✅ Sync statistics retrieved');
        console.log(`📈 Total syncs: ${result.data.total_syncs}`);
        console.log(`✅ Successful: ${result.data.successful_syncs}`);
        console.log(`❌ Failed: ${result.data.failed_syncs}`);
        console.log(`⏱️ Avg time: ${result.data.avg_sync_time_ms}ms`);
        console.log(`🎯 Integrity score: ${result.data.data_integrity_score}%`);
        console.log(`🔄 Last 24h syncs: ${result.data.last_24h_syncs}`);
        console.log(`🤝 Resolution rate: ${result.data.conflict_resolution_rate}%`);
      } else {
        console.log('❌ Failed to get statistics');
      }

    } catch (error) {
      console.error(`❌ Error testing stats for ${timeRange}:`, error.message);
    }
  }
}

// Test force synchronization
async function testForceSynchronization() {
  console.log('\n=== Testing Force Synchronization API ===');
  
  const syncRequest = {
    trip_id: TEST_CONFIG.tripId,
    force_full_sync: true,
    include_images: true,
    include_ratings: true,
    include_opening_hours: true
  };

  try {
    const response = await fetch(`${API_URL}/sync/force`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(syncRequest)
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('✅ Force synchronization completed');
      console.log(`🆔 Sync ID: ${result.data.sync_id}`);
      console.log(`🔄 Changes applied: ${result.data.changes_applied}`);
      console.log(`⚠️ Conflicts detected: ${result.data.conflicts_detected}`);
      console.log(`⏱️ Execution time: ${result.data.performance.execution_time_ms}ms`);
      console.log(`📊 Data transferred: ${result.data.performance.data_transferred_kb}KB`);
      
      if (result.data.errors.length > 0) {
        console.log('⚠️ Errors occurred:');
        result.data.errors.forEach(error => console.log(`  - ${error}`));
      }
      return result.data;
    } else {
      console.log('❌ Failed to force synchronization');
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing force sync:', error.message);
    return null;
  }
}

// Test conflict resolution
async function testConflictResolution() {
  console.log('\n=== Testing Conflict Resolution API ===');
  
  // First check for existing conflicts
  const conflicts = await testSyncConflictDetection();
  
  if (!conflicts || conflicts.total_conflicts === 0) {
    console.log('ℹ️ No conflicts to resolve');
    return;
  }

  // Create sample resolutions
  const resolutions = [
    {
      conflict_id: 'sample-conflict-id-1',
      resolution_strategy: 'use_local',
      comment: 'Using local version as it has more recent data'
    },
    {
      conflict_id: 'sample-conflict-id-2',
      resolution_strategy: 'merge',
      merged_data: {
        name: 'Merged Place Name',
        description: 'Merged description with both versions'
      },
      comment: 'Merged both versions'
    }
  ];

  try {
    const response = await fetch(`${API_URL}/sync/resolve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resolutions)
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('✅ Conflict resolution completed');
      console.log(`📊 Total resolutions: ${result.data.total_resolutions}`);
      console.log(`✅ Successful: ${result.data.successful_resolutions}`);
      console.log(`❌ Failed: ${result.data.failed_resolutions}`);
      
      result.data.results.forEach(res => {
        const status = res.success ? '✅' : '❌';
        console.log(`${status} Conflict ${res.conflict_id}: ${res.success ? res.applied_strategy : res.error}`);
      });
      return result.data;
    } else {
      console.log('❌ Failed to resolve conflicts');
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing conflict resolution:', error.message);
    return null;
  }
}

// Test sync data validation
async function testSyncDataValidation() {
  console.log('\n=== Testing Sync Data Validation API ===');
  
  const validationRequest = {
    trip_id: TEST_CONFIG.tripId
  };

  try {
    const response = await fetch(`${API_URL}/sync/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validationRequest)
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('✅ Sync data validation completed');
      console.log(`📊 Validation score: ${result.data.validation_score}%`);
      console.log(`🎯 Status: ${result.data.status}`);
      
      if (result.data.validations) {
        result.data.validations.forEach(validation => {
          const status = validation.passed ? '✅' : '❌';
          console.log(`${status} ${validation.validation_type}: ${validation.details}`);
        });
      }

      console.log('💡 Recommendations:');
      result.data.recommendations.forEach(rec => console.log(`  - ${rec}`));
      
      return result.data;
    } else {
      console.log('❌ Failed to validate sync data');
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing sync validation:', error.message);
    return null;
  }
}

// Run comprehensive sync API tests
async function runSyncAPITests() {
  console.log('🧪 Starting Place Data Synchronization API Tests');
  console.log('================================================');

  const results = {
    syncStatus: null,
    integrityCheck: null,
    conflictDetection: null,
    syncStats: null,
    forceSync: null,
    conflictResolution: null,
    dataValidation: null
  };

  // Test all sync endpoints
  results.syncStatus = await testGetSyncStatus();
  results.integrityCheck = await testDataIntegrityCheck();
  results.conflictDetection = await testSyncConflictDetection();
  await testSyncStatistics(); // Multiple time ranges
  results.forceSync = await testForceSynchronization();
  results.conflictResolution = await testConflictResolution();
  results.dataValidation = await testSyncDataValidation();

  // Print summary
  console.log('\n📋 Test Summary');
  console.log('===============');
  
  const tests = [
    { name: 'Sync Status', result: results.syncStatus },
    { name: 'Integrity Check', result: results.integrityCheck },
    { name: 'Conflict Detection', result: results.conflictDetection },
    { name: 'Force Sync', result: results.forceSync },
    { name: 'Conflict Resolution', result: results.conflictResolution },
    { name: 'Data Validation', result: results.dataValidation }
  ];

  tests.forEach(test => {
    const status = test.result !== null ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
  });

  const passedTests = tests.filter(test => test.result !== null).length;
  const totalTests = tests.length;
  
  console.log(`\n🎯 Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All sync API tests completed successfully!');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
  }

  return results;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runSyncAPITests,
    testGetSyncStatus,
    testDataIntegrityCheck,
    testSyncConflictDetection,
    testSyncStatistics,
    testForceSynchronization,
    testConflictResolution,
    testSyncDataValidation
  };
}

// Run tests if called directly
if (require.main === module) {
  runSyncAPITests().catch(console.error);
}