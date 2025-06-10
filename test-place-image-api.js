/**
 * TODO-079: Place Image Management API Test Script
 * Tests the image upload, list, update, and delete functionality
 */

const API_BASE_URL = 'https://kntvuqtklacsgkqcwixj.supabase.co';
const FUNCTION_URL = `${API_BASE_URL}/functions/v1/place-management`;

// Test configuration
const TEST_CONFIG = {
  // Replace with actual test user ID and test place ID
  testUserId: 'test-user-uuid',
  testTripId: 'test-trip-uuid', 
  testPlaceId: 'test-place-uuid',
  
  // Sample base64 image data (1x1 pixel PNG)
  sampleImageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  
  // Authorization header (replace with actual JWT token)
  authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

/**
 * Test cases for place image management
 */
const testCases = [
  {
    name: 'Upload Place Image - Valid Request',
    method: 'POST',
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader,
      'Content-Type': 'application/json'
    },
    body: {
      place_id: TEST_CONFIG.testPlaceId,
      image_data: TEST_CONFIG.sampleImageData,
      image_name: 'Test Image',
      image_description: 'A test image for the place',
      is_primary: true
    },
    expectedStatus: 201,
    expectedFields: ['success', 'image'],
    imageFields: ['id', 'url', 'name', 'description', 'is_primary', 'uploaded_at', 'file_size']
  },
  
  {
    name: 'Upload Place Image - Missing Required Fields',
    method: 'POST',
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader,
      'Content-Type': 'application/json'
    },
    body: {
      image_data: TEST_CONFIG.sampleImageData
      // Missing place_id
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Upload Place Image - Invalid Place ID',
    method: 'POST', 
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader,
      'Content-Type': 'application/json'
    },
    body: {
      place_id: 'invalid-place-id',
      image_data: TEST_CONFIG.sampleImageData,
      image_name: 'Test Image'
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Get Place Images - By Place ID',
    method: 'GET',
    endpoint: `/images?place_id=${TEST_CONFIG.testPlaceId}`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'images', 'pagination'],
    imageArrayFields: ['id', 'place_id', 'place_name', 'trip_id', 'trip_name', 'image_url', 'image_name', 'image_description', 'is_primary', 'uploaded_at']
  },
  
  {
    name: 'Get Place Images - By Trip ID',
    method: 'GET',
    endpoint: `/images?trip_id=${TEST_CONFIG.testTripId}`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'images', 'pagination']
  },
  
  {
    name: 'Get Place Images - By User ID',
    method: 'GET',
    endpoint: `/images?user_id=${TEST_CONFIG.testUserId}`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'images', 'pagination']
  },
  
  {
    name: 'Get Place Images - With Metadata',
    method: 'GET',
    endpoint: `/images?place_id=${TEST_CONFIG.testPlaceId}&include_metadata=true`,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'images', 'pagination'],
    metadataFields: ['file_size', 'content_type', 'uploaded_by']
  },
  
  {
    name: 'Get Place Images - Missing Parameters',
    method: 'GET',
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Update Place Image - Valid Request',
    method: 'PUT',
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader,
      'Content-Type': 'application/json'
    },
    body: {
      image_id: 'IMAGE_ID_FROM_UPLOAD', // Will be set dynamically
      place_id: TEST_CONFIG.testPlaceId,
      image_name: 'Updated Test Image',
      image_description: 'Updated description',
      is_primary: false
    },
    expectedStatus: 200,
    expectedFields: ['success', 'image']
  },
  
  {
    name: 'Update Place Image - Missing Required Fields',
    method: 'PUT',
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader,
      'Content-Type': 'application/json'
    },
    body: {
      image_name: 'Updated Test Image'
      // Missing image_id and place_id
    },
    expectedStatus: 400,
    expectedFields: ['error']
  },
  
  {
    name: 'Delete Place Image - Valid Request',
    method: 'DELETE',
    endpoint: '/images?image_id=IMAGE_ID_FROM_UPLOAD&place_id=' + TEST_CONFIG.testPlaceId,
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 200,
    expectedFields: ['success', 'message', 'deleted_image_id']
  },
  
  {
    name: 'Delete Place Image - Missing Parameters',
    method: 'DELETE',
    endpoint: '/images',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400,
    expectedFields: ['error']
  }
];

/**
 * Execute a single test case
 */
async function executeTestCase(testCase, uploadedImageId = null) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📋 ${testCase.method} ${testCase.endpoint}`);
  
  try {
    // Replace dynamic values
    let endpoint = testCase.endpoint;
    let body = testCase.body;
    
    if (uploadedImageId && endpoint.includes('IMAGE_ID_FROM_UPLOAD')) {
      endpoint = endpoint.replace('IMAGE_ID_FROM_UPLOAD', uploadedImageId);
    }
    
    if (uploadedImageId && body && body.image_id === 'IMAGE_ID_FROM_UPLOAD') {
      body = { ...body, image_id: uploadedImageId };
    }
    
    const requestOptions = {
      method: testCase.method,
      headers: testCase.headers
    };
    
    if (body) {
      requestOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(FUNCTION_URL + endpoint, requestOptions);
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
    
    // Validate image fields if specified
    if (testCase.imageFields && responseData.image) {
      for (const field of testCase.imageFields) {
        if (!(field in responseData.image)) {
          console.log(`❌ FAIL: Missing expected image field '${field}'`);
          return { success: false, response: responseData };
        }
      }
    }
    
    // Validate image array fields if specified
    if (testCase.imageArrayFields && responseData.images && responseData.images.length > 0) {
      const firstImage = responseData.images[0];
      for (const field of testCase.imageArrayFields) {
        if (!(field in firstImage)) {
          console.log(`❌ FAIL: Missing expected image array field '${field}'`);
          return { success: false, response: responseData };
        }
      }
    }
    
    // Validate metadata fields if specified
    if (testCase.metadataFields && responseData.images && responseData.images.length > 0) {
      const firstImage = responseData.images[0];
      for (const field of testCase.metadataFields) {
        if (!(field in firstImage)) {
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
  console.log('🚀 Starting Place Image Management API Tests');
  console.log('=' .repeat(60));
  
  let passedTests = 0;
  let failedTests = 0;
  let uploadedImageId = null;
  
  for (const testCase of testCases) {
    const result = await executeTestCase(testCase, uploadedImageId);
    
    if (result.success) {
      passedTests++;
      
      // Store uploaded image ID for subsequent tests
      if (testCase.name.includes('Upload Place Image - Valid Request') && result.response.image) {
        uploadedImageId = result.response.image.id;
        console.log(`🔑 Stored uploaded image ID: ${uploadedImageId}`);
      }
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
 * Test with real API endpoints (for integration testing)
 */
async function testWithRealAPI() {
  console.log('🔗 Testing with real Supabase Edge Function...');
  
  // First, test basic endpoint connectivity
  const connectivityTest = {
    name: 'API Connectivity Test',
    method: 'GET',
    endpoint: '/images?place_id=test',
    headers: {
      'Authorization': TEST_CONFIG.authHeader
    },
    expectedStatus: 400, // Should fail with bad auth but show API is responding
    expectedFields: ['error']
  };
  
  const result = await executeTestCase(connectivityTest);
  if (result.success || result.response) {
    console.log('✅ API endpoint is accessible');
  } else {
    console.log('❌ API endpoint is not accessible');
  }
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    runSpecificTest,
    testWithRealAPI,
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
      case 'connectivity':
        testWithRealAPI();
        break;
      case 'test':
        if (args[1]) {
          runSpecificTest(args[1]);
        } else {
          console.log('❌ Please specify test name: node test-place-image-api.js test "Test Name"');
        }
        break;
      default:
        console.log('Usage:');
        console.log('  node test-place-image-api.js all           - Run all tests');
        console.log('  node test-place-image-api.js connectivity  - Test API connectivity');
        console.log('  node test-place-image-api.js test "name"   - Run specific test');
    }
  } else {
    runAllTests();
  }
}