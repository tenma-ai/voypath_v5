// Comprehensive test script for Place Deletion Impact Analysis API (TODO-085)
// Tests the GET /place-management/analyze/deletion endpoint

// You need to configure these with your actual Supabase project details
const SUPABASE_URL = 'https://your-supabase-url.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/place-management`;

// Test configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
const TEST_CONFIG = {
  // Get these from your Supabase dashboard and existing data
  user_auth_token: 'your-auth-token-here', // From Supabase Auth session
  test_place_id: 'test-place-uuid-here',    // Existing place ID from your database
  test_trip_id: 'test-trip-uuid-here'       // Existing trip ID from your database
};

// Configuration validation
const VALIDATE_CONFIG = () => {
  const requiredFields = ['user_auth_token', 'test_place_id', 'test_trip_id'];
  const missingFields = requiredFields.filter(field => 
    !TEST_CONFIG[field] || TEST_CONFIG[field].includes('your-') || TEST_CONFIG[field].includes('test-')
  );
  
  if (missingFields.length > 0) {
    console.error('❌ Missing required test configuration:');
    missingFields.forEach(field => {
      console.error(`   - ${field}: Please set a valid value in TEST_CONFIG`);
    });
    console.error('\n💡 How to get these values:');
    console.error('   1. user_auth_token: Login to your app and copy the JWT token from browser dev tools');
    console.error('   2. test_place_id: Get an existing place UUID from your Supabase dashboard');
    console.error('   3. test_trip_id: Get an existing trip UUID from your Supabase dashboard');
    console.error('   4. SUPABASE_URL: Update with your actual Supabase project URL');
    return false;
  }
  return true;
};

// Test helper functions
function logTest(testName, status, details = '') {
  const timestamp = new Date().toISOString();
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`[${timestamp}] ${statusIcon} ${testName}: ${status}`);
  if (details) {
    console.log(`   Details: ${details}`);
  }
}

function validateResponse(response, expectedStatus = 200) {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }
  return true;
}

function validateDeletionImpactStructure(data) {
  const required = [
    'place_info',
    'impact_analysis', 
    'analysis_timestamp',
    'analyzed_by'
  ];
  
  for (const field of required) {
    if (!data.hasOwnProperty(field)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate impact_analysis structure
  const impactAnalysis = data.impact_analysis;
  const requiredImpactFields = [
    'place_id',
    'place_name', 
    'impact_severity',
    'affected_systems',
    'affected_users',
    'dependent_places',
    'schedule_conflicts',
    'optimization_effects',
    'analysis_metadata'
  ];

  for (const field of requiredImpactFields) {
    if (!impactAnalysis.hasOwnProperty(field)) {
      throw new Error(`Missing required impact analysis field: ${field}`);
    }
  }

  // Validate severity values
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (!validSeverities.includes(impactAnalysis.impact_severity)) {
    throw new Error(`Invalid impact severity: ${impactAnalysis.impact_severity}`);
  }

  // Validate arrays
  if (!Array.isArray(impactAnalysis.affected_systems)) {
    throw new Error('affected_systems must be an array');
  }
  if (!Array.isArray(impactAnalysis.affected_users)) {
    throw new Error('affected_users must be an array');
  }
  if (!Array.isArray(impactAnalysis.dependent_places)) {
    throw new Error('dependent_places must be an array');
  }
  if (!Array.isArray(impactAnalysis.schedule_conflicts)) {
    throw new Error('schedule_conflicts must be an array');
  }
  if (!Array.isArray(impactAnalysis.optimization_effects)) {
    throw new Error('optimization_effects must be an array');
  }

  return true;
}

// Test 1: Basic Deletion Impact Analysis
async function testBasicDeletionImpactAnalysis() {
  const testName = 'Basic Deletion Impact Analysis';
  
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/analyze/deletion?place_id=${TEST_CONFIG.test_place_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.user_auth_token}`,
        'Content-Type': 'application/json'
      }
    });

    validateResponse(response, 200);
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Analysis failed: ${result.error || 'Unknown error'}`);
    }

    validateDeletionImpactStructure(result.data);
    
    logTest(testName, 'PASS', `Impact severity: ${result.data.impact_analysis.impact_severity}, ` +
      `Affected systems: ${result.data.impact_analysis.affected_systems.length}, ` +
      `Execution time: ${result.data.impact_analysis.analysis_metadata.execution_time_ms}ms`);
    
    return result.data;
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 2: Missing Place ID Parameter
async function testMissingPlaceIdParameter() {
  const testName = 'Missing Place ID Parameter';
  
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/analyze/deletion`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.user_auth_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 400) {
      const result = await response.json();
      if (result.error && result.error.includes('place_id parameter is required')) {
        logTest(testName, 'PASS', 'Correctly rejected missing place_id parameter');
      } else {
        throw new Error('Wrong error message for missing place_id');
      }
    } else {
      throw new Error(`Expected 400 status, got ${response.status}`);
    }
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 3: Invalid Place ID
async function testInvalidPlaceId() {
  const testName = 'Invalid Place ID';
  
  try {
    const invalidPlaceId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(`${EDGE_FUNCTION_URL}/analyze/deletion?place_id=${invalidPlaceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.user_auth_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 404) {
      const result = await response.json();
      if (result.error && result.error.includes('Place not found')) {
        logTest(testName, 'PASS', 'Correctly rejected invalid place_id');
      } else {
        throw new Error('Wrong error message for invalid place_id');
      }
    } else {
      throw new Error(`Expected 404 status, got ${response.status}`);
    }
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 4: Unauthorized Access
async function testUnauthorizedAccess() {
  const testName = 'Unauthorized Access';
  
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/analyze/deletion?place_id=${TEST_CONFIG.test_place_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      }
    });

    if (response.status === 401) {
      const result = await response.json();
      if (result.error && result.error.includes('Unauthorized')) {
        logTest(testName, 'PASS', 'Correctly rejected unauthorized request');
      } else {
        throw new Error('Wrong error message for unauthorized access');
      }
    } else {
      throw new Error(`Expected 401 status, got ${response.status}`);
    }
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 5: Impact Severity Calculation Validation
async function testImpactSeverityCalculation(analysisData) {
  const testName = 'Impact Severity Calculation Validation';
  
  try {
    const impact = analysisData.impact_analysis;
    
    // Calculate expected severity based on the algorithm
    let expectedScore = 0;
    expectedScore += impact.affected_systems.length * 10;
    expectedScore += Math.min(impact.affected_users.length * 5, 50);
    
    const highDependencies = impact.dependent_places.filter(d => d.dependency_strength === 'high').length;
    const mediumDependencies = impact.dependent_places.filter(d => d.dependency_strength === 'medium').length;
    expectedScore += highDependencies * 15 + mediumDependencies * 10;
    
    const highConflicts = impact.schedule_conflicts.filter(c => c.severity === 'high').length;
    const mediumConflicts = impact.schedule_conflicts.filter(c => c.severity === 'medium').length;
    expectedScore += highConflicts * 20 + mediumConflicts * 15;
    
    const significantEffects = impact.optimization_effects.filter(e => Math.abs(e.impact_percentage) >= 10).length;
    expectedScore += significantEffects * 15;
    
    let expectedSeverity;
    if (expectedScore >= 80) expectedSeverity = 'critical';
    else if (expectedScore >= 50) expectedSeverity = 'high';
    else if (expectedScore >= 20) expectedSeverity = 'medium';
    else expectedSeverity = 'low';
    
    if (impact.impact_severity === expectedSeverity) {
      logTest(testName, 'PASS', `Severity calculation is correct: ${expectedSeverity} (score: ${expectedScore})`);
    } else {
      throw new Error(`Expected severity ${expectedSeverity} (score: ${expectedScore}), got ${impact.impact_severity}`);
    }
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 6: Analysis Metadata Validation
async function testAnalysisMetadataValidation(analysisData) {
  const testName = 'Analysis Metadata Validation';
  
  try {
    const metadata = analysisData.impact_analysis.analysis_metadata;
    
    // Check required metadata fields
    const requiredFields = ['execution_time_ms', 'analysis_depth', 'confidence_score', 'timestamp'];
    for (const field of requiredFields) {
      if (!metadata.hasOwnProperty(field)) {
        throw new Error(`Missing metadata field: ${field}`);
      }
    }
    
    // Validate execution time is reasonable (should be < 10 seconds for this test)
    if (metadata.execution_time_ms > 10000) {
      throw new Error(`Execution time too long: ${metadata.execution_time_ms}ms`);
    }
    
    // Validate confidence score is between 0 and 1
    if (metadata.confidence_score < 0 || metadata.confidence_score > 1) {
      throw new Error(`Invalid confidence score: ${metadata.confidence_score}`);
    }
    
    // Validate analysis depth
    if (metadata.analysis_depth !== 'comprehensive') {
      throw new Error(`Unexpected analysis depth: ${metadata.analysis_depth}`);
    }
    
    // Validate timestamp format
    const timestamp = new Date(metadata.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new Error(`Invalid timestamp format: ${metadata.timestamp}`);
    }
    
    logTest(testName, 'PASS', `Execution: ${metadata.execution_time_ms}ms, ` +
      `Confidence: ${metadata.confidence_score}, Depth: ${metadata.analysis_depth}`);
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 7: Dependent Places Analysis Validation
async function testDependentPlacesAnalysis(analysisData) {
  const testName = 'Dependent Places Analysis Validation';
  
  try {
    const dependentPlaces = analysisData.impact_analysis.dependent_places;
    
    // Validate dependent place structure
    for (const dep of dependentPlaces) {
      const requiredFields = ['dependent_place_id', 'dependent_place_name', 'dependency_type', 'dependency_strength', 'details'];
      for (const field of requiredFields) {
        if (!dep.hasOwnProperty(field)) {
          throw new Error(`Missing dependent place field: ${field}`);
        }
      }
      
      // Validate dependency types
      const validTypes = ['geographic_proximity', 'temporal_scheduling', 'logical_dependency'];
      if (!validTypes.includes(dep.dependency_type)) {
        throw new Error(`Invalid dependency type: ${dep.dependency_type}`);
      }
      
      // Validate dependency strength
      const validStrengths = ['low', 'medium', 'high'];
      if (!validStrengths.includes(dep.dependency_strength)) {
        throw new Error(`Invalid dependency strength: ${dep.dependency_strength}`);
      }
    }
    
    logTest(testName, 'PASS', `Found ${dependentPlaces.length} dependent places`);
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Test 8: Optimization Effects Analysis
async function testOptimizationEffectsAnalysis(analysisData) {
  const testName = 'Optimization Effects Analysis';
  
  try {
    const optimizationEffects = analysisData.impact_analysis.optimization_effects;
    
    // Validate optimization effect structure
    for (const effect of optimizationEffects) {
      const requiredFields = ['optimization_type', 'current_score', 'projected_score', 'impact_percentage', 'mitigation_strategies'];
      for (const field of requiredFields) {
        if (!effect.hasOwnProperty(field)) {
          throw new Error(`Missing optimization effect field: ${field}`);
        }
      }
      
      // Validate optimization types
      const validTypes = ['route', 'time', 'cost', 'preference'];
      if (!validTypes.includes(effect.optimization_type)) {
        throw new Error(`Invalid optimization type: ${effect.optimization_type}`);
      }
      
      // Validate scores are between 0 and 1
      if (effect.current_score < 0 || effect.current_score > 1) {
        throw new Error(`Invalid current score: ${effect.current_score}`);
      }
      if (effect.projected_score < 0 || effect.projected_score > 1) {
        throw new Error(`Invalid projected score: ${effect.projected_score}`);
      }
      
      // Validate mitigation strategies is an array
      if (!Array.isArray(effect.mitigation_strategies)) {
        throw new Error('mitigation_strategies must be an array');
      }
    }
    
    logTest(testName, 'PASS', `Found ${optimizationEffects.length} optimization effects`);
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Performance benchmark test
async function performanceBenchmarkTest() {
  const testName = 'Performance Benchmark';
  
  try {
    const iterations = 5;
    const executionTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      const response = await fetch(`${EDGE_FUNCTION_URL}/analyze/deletion?place_id=${TEST_CONFIG.test_place_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.user_auth_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      validateResponse(response, 200);
      const result = await response.json();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      executionTimes.push(executionTime);
    }
    
    const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / iterations;
    const maxTime = Math.max(...executionTimes);
    const minTime = Math.min(...executionTimes);
    
    logTest(testName, 'PASS', `Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime}ms, Max: ${maxTime}ms over ${iterations} iterations`);
    
  } catch (error) {
    logTest(testName, 'FAIL', error.message);
    throw error;
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Place Deletion Impact Analysis API Tests (TODO-085)');
  console.log('='.repeat(80));
  
  try {
    // Validate test configuration
    if (!VALIDATE_CONFIG()) {
      throw new Error('Invalid test configuration. Please update TEST_CONFIG with valid values.');
    }
    
    logTest('Test Configuration', 'INFO', 'All required test parameters are set');
    
    // Run basic functionality tests
    await testUnauthorizedAccess();
    await testMissingPlaceIdParameter();
    await testInvalidPlaceId();
    
    // Run main analysis test and get data for validation tests
    const analysisData = await testBasicDeletionImpactAnalysis();
    
    // Run detailed validation tests using the analysis data
    await testImpactSeverityCalculation(analysisData);
    await testAnalysisMetadataValidation(analysisData);
    await testDependentPlacesAnalysis(analysisData);
    await testOptimizationEffectsAnalysis(analysisData);
    
    // Run performance benchmark
    await performanceBenchmarkTest();
    
    console.log('='.repeat(80));
    console.log('✅ All Place Deletion Impact Analysis API tests completed successfully!');
    console.log('\n📊 Analysis Summary:');
    console.log(`   Impact Severity: ${analysisData.impact_analysis.impact_severity}`);
    console.log(`   Affected Systems: ${analysisData.impact_analysis.affected_systems.length}`);
    console.log(`   Affected Users: ${analysisData.impact_analysis.affected_users.length}`);
    console.log(`   Dependent Places: ${analysisData.impact_analysis.dependent_places.length}`);
    console.log(`   Schedule Conflicts: ${analysisData.impact_analysis.schedule_conflicts.length}`);
    console.log(`   Optimization Effects: ${analysisData.impact_analysis.optimization_effects.length}`);
    console.log(`   Confidence Score: ${analysisData.impact_analysis.analysis_metadata.confidence_score}`);
    
  } catch (error) {
    console.log('='.repeat(80));
    console.log('❌ Test execution failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Verify your Supabase URL and auth token');
    console.log('   2. Ensure the test place and trip exist in your database');
    console.log('   3. Check that the place-management Edge Function is deployed');
    console.log('   4. Verify the user has access to the test trip');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testBasicDeletionImpactAnalysis,
  testMissingPlaceIdParameter,
  testInvalidPlaceId,
  testUnauthorizedAccess,
  TEST_CONFIG
};