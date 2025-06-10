/**
 * TODO-080: Place Statistics API Test Script
 * Tests the place statistics functionality with various query parameters
 */

const API_BASE_URL = 'https://kntvuqtklacsgkqcwixj.supabase.co';
const FUNCTION_URL = `${API_BASE_URL}/functions/v1/place-management`;

// Test configuration
const TEST_CONFIG = {
  // Replace with actual test user ID and test trip ID
  testUserId: 'test-user-uuid',
  testTripId: 'test-trip-uuid',
  testCategory: 'Restaurant',
  
  // Authorization header (replace with actual JWT token)
  authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

/**
 * Test cases for place statistics API
 */
const testCases = [
  {
    name: 'Get Trip Statistics - Basic',
    method: 'GET',
    endpoint: `/stats?stats_type=trip&trip_id=${TEST_CONFIG.testTripId}`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata'],
    statsFields: ['summary'],
    summaryFields: ['total_places', 'total_trips', 'total_users', 'average_wish_level', 'average_rating', 'most_popular_category']
  },
  
  {
    name: 'Get Trip Statistics - With Details',
    method: 'GET',
    endpoint: `/stats?stats_type=trip&trip_id=${TEST_CONFIG.testTripId}&include_details=true`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata'],
    detailsExpected: true
  },
  
  {
    name: 'Get User Statistics',
    method: 'GET',
    endpoint: `/stats?stats_type=user&user_id=${TEST_CONFIG.testUserId}`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata']
  },
  
  {
    name: 'Get Global Statistics',
    method: 'GET',
    endpoint: '/stats?stats_type=global',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata'],
    categoryBreakdownExpected: true
  },
  
  {
    name: 'Get Category Statistics',
    method: 'GET',
    endpoint: `/stats?stats_type=category&category=${TEST_CONFIG.testCategory}`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata']
  },
  
  {
    name: 'Get Popularity Ranking',
    method: 'GET',
    endpoint: '/stats?stats_type=popularity&limit=10',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata'],
    popularityRankingExpected: true
  },
  
  {
    name: 'Get Statistics with Date Range',
    method: 'GET',
    endpoint: `/stats?stats_type=trip&trip_id=${TEST_CONFIG.testTripId}&start_date=2024-01-01&end_date=2024-12-31`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata']
  },
  
  {
    name: 'Get Statistics with Time Series',
    method: 'GET',
    endpoint: `/stats?stats_type=trip&trip_id=${TEST_CONFIG.testTripId}&include_details=true&start_date=2024-01-01&end_date=2024-12-31&time_range=weekly`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata'],
    timeSeriesExpected: true
  },
  
  {
    name: 'Get Statistics - Missing Required Trip ID',
    method: 'GET',
    endpoint: '/stats?stats_type=trip',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Get Statistics - Missing Required User ID',
    method: 'GET',
    endpoint: '/stats?stats_type=user',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Get Statistics - Missing Required Category',
    method: 'GET',
    endpoint: '/stats?stats_type=category',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Get Statistics - Invalid Stats Type',
    method: 'GET',
    endpoint: '/stats?stats_type=invalid',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Get Statistics - Unauthorized Access',
    method: 'GET',
    endpoint: `/stats?stats_type=trip&trip_id=${TEST_CONFIG.testTripId}`,
    headers: {
      // No authorization header
    },
    expectedStatus: 401,
    expectedFields: ['error']
  }
];

/**
 * Execute a single test case
 */
async function executeTestCase(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📋 ${testCase.method} ${testCase.endpoint}`);
  
  try {
    const requestOptions = {
      method: testCase.method,
      headers: testCase.headers || {}
    };
    
    const response = await fetch(FUNCTION_URL + testCase.endpoint, requestOptions);
    const responseData = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(responseData, null, 2));
    
    // Validate status code
    if (response.status !== testCase.expectedStatus) {
      console.log(`❌ FAIL: Expected status ${testCase.expectedStatus}, got ${response.status}`);
      return { success: false, response: responseData };
    }
    
    // Validate expected fields
    for (const field of testCase.expectedFields) {
      if (!(field in responseData)) {
        console.log(`❌ FAIL: Missing expected field '${field}'`);
        return { success: false, response: responseData };
      }
    }
    
    // Validate stats fields if specified
    if (testCase.statsFields && responseData.stats) {
      for (const field of testCase.statsFields) {
        if (!(field in responseData.stats)) {
          console.log(`❌ FAIL: Missing expected stats field '${field}'`);
          return { success: false, response: responseData };
        }
      }
    }
    
    // Validate summary fields if specified
    if (testCase.summaryFields && responseData.stats && responseData.stats.summary) {
      for (const field of testCase.summaryFields) {
        if (!(field in responseData.stats.summary)) {
          console.log(`❌ FAIL: Missing expected summary field '${field}'`);
          return { success: false, response: responseData };
        }
      }
    }
    
    // Validate category breakdown if expected
    if (testCase.categoryBreakdownExpected && responseData.stats) {
      if (!responseData.stats.category_breakdown || !Array.isArray(responseData.stats.category_breakdown)) {
        console.log(`❌ FAIL: Expected category_breakdown array`);
        return { success: false, response: responseData };
      }
    }
    
    // Validate popularity ranking if expected
    if (testCase.popularityRankingExpected && responseData.stats) {
      if (!responseData.stats.popularity_ranking || !Array.isArray(responseData.stats.popularity_ranking)) {
        console.log(`❌ FAIL: Expected popularity_ranking array`);
        return { success: false, response: responseData };
      }
    }
    
    // Validate time series if expected
    if (testCase.timeSeriesExpected && responseData.stats) {
      if (!responseData.stats.time_series || !Array.isArray(responseData.stats.time_series)) {
        console.log(`❌ FAIL: Expected time_series array`);
        return { success: false, response: responseData };
      }
    }
    
    // Validate details if expected
    if (testCase.detailsExpected && responseData.stats) {
      if (!responseData.stats.details || typeof responseData.stats.details !== 'object') {
        console.log(`❌ FAIL: Expected details object`);
        return { success: false, response: responseData };
      }
    }
    
    // Validate metadata structure
    if (responseData.metadata) {
      const requiredMetadataFields = ['generated_at', 'stats_type', 'data_range'];
      for (const field of requiredMetadataFields) {
        if (!(field in responseData.metadata)) {
          console.log(`❌ FAIL: Missing expected metadata field '${field}'`);
          return { success: false, response: responseData };
        }
      }
    }
    
    console.log(`✅ PASS: All validations successful`);
    return { success: true, response: responseData };
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all test cases
 */
async function runAllTests() {
  console.log('🚀 Starting Place Statistics API Tests');
  console.log('=' .repeat(60));
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of testCases) {
    const result = await executeTestCase(testCase);
    
    if (result.success) {
      passedTests++;
    } else {
      failedTests++;
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Test Results Summary');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${passedTests + failedTests}`);
  console.log(`🎯 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
}

/**
 * Run specific test by name
 */
async function runSpecificTest(testName) {
  const testCase = testCases.find(tc => tc.name === testName);
  if (!testCase) {
    console.log(`❌ Test '${testName}' not found`);
    return;
  }
  
  console.log(`🧪 Running specific test: ${testName}`);
  const result = await executeTestCase(testCase);
  return result;
}

/**
 * Test response structure validation
 */
function validateStatsResponse(response) {
  const validations = {
    'Has success field': 'success' in response,
    'Has stats object': 'stats' in response && typeof response.stats === 'object',
    'Has metadata object': 'metadata' in response && typeof response.metadata === 'object',
    'Has summary in stats': response.stats && 'summary' in response.stats,
    'Summary has required fields': response.stats?.summary && 
      ['total_places', 'total_trips', 'total_users', 'average_wish_level', 'average_rating'].every(
        field => field in response.stats.summary
      ),
    'Metadata has required fields': response.metadata && 
      ['generated_at', 'stats_type', 'data_range'].every(
        field => field in response.metadata
      )
  };
  
  console.log('\n📋 Response Structure Validation:');
  for (const [check, passed] of Object.entries(validations)) {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  }
  
  return Object.values(validations).every(v => v);
}

/**
 * Test with performance measurement
 */
async function testWithPerformance() {
  console.log('⚡ Performance Testing...');
  
  const performanceTest = {
    name: 'Performance Test - Global Stats',
    method: 'GET',
    endpoint: '/stats?stats_type=global&include_details=true',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'stats', 'metadata']
  };
  
  const startTime = Date.now();
  const result = await executeTestCase(performanceTest);
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  console.log(`⏱️  Response Time: ${responseTime}ms`);
  
  if (responseTime > 5000) {
    console.log('⚠️  WARNING: Response time is quite high (>5s)');
  } else if (responseTime > 2000) {
    console.log('⚠️  NOTICE: Response time is moderate (>2s)');
  } else {
    console.log('✅ Response time is good (<2s)');
  }
  
  return { result, responseTime };
}

/**
 * Test statistics accuracy
 */
function testStatisticsAccuracy(response) {
  if (!response.stats || !response.stats.summary) {
    console.log('❌ Cannot test accuracy: missing stats.summary');
    return false;
  }
  
  const summary = response.stats.summary;
  
  console.log('\n🔍 Statistics Accuracy Check:');
  
  const checks = [
    {
      name: 'Average wish level is valid',
      check: summary.average_wish_level >= 0 && summary.average_wish_level <= 5
    },
    {
      name: 'Average rating is valid',
      check: summary.average_rating >= 0 && summary.average_rating <= 5
    },
    {
      name: 'Total places is non-negative',
      check: summary.total_places >= 0
    },
    {
      name: 'Total trips is non-negative',
      check: summary.total_trips >= 0
    },
    {
      name: 'Total users is non-negative',
      check: summary.total_users >= 0
    },
    {
      name: 'Total cost is non-negative',
      check: summary.total_estimated_cost >= 0
    },
    {
      name: 'Total duration is non-negative',
      check: summary.total_stay_duration_hours >= 0
    }
  ];
  
  let passedChecks = 0;
  for (const check of checks) {
    const passed = check.check;
    console.log(`${passed ? '✅' : '❌'} ${check.name}`);
    if (passed) passedChecks++;
  }
  
  const accuracyScore = (passedChecks / checks.length) * 100;
  console.log(`📊 Accuracy Score: ${accuracyScore.toFixed(1)}%`);
  
  return accuracyScore >= 100;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    runSpecificTest,
    testWithPerformance,
    validateStatsResponse,
    testStatisticsAccuracy,
    executeTestCase,
    testCases,
    TEST_CONFIG
  };
}

// Run tests if script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const command = args[0];
    
    switch (command) {
      case 'all':
        runAllTests();
        break;
      case 'performance':
        testWithPerformance();
        break;
      case 'test':
        if (args[1]) {
          runSpecificTest(args[1]);
        } else {
          console.log('❌ Please specify test name: node test-place-stats-api.js test "Test Name"');
        }
        break;
      default:
        console.log('Usage:');
        console.log('  node test-place-stats-api.js all          - Run all tests');
        console.log('  node test-place-stats-api.js performance  - Test performance');
        console.log('  node test-place-stats-api.js test "name"  - Run specific test');
    }
  } else {
    runAllTests();
  }
}