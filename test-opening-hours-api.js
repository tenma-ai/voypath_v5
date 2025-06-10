/**
 * Test script for Opening Hours Management API (TODO-082)
 * Tests the new opening hours endpoints in place-management function
 */

const API_BASE_URL = 'https://your-project-ref.supabase.co/functions/v1/place-management';

// Test data
const testData = {
  // Sample opening hours (0=Sunday, 6=Saturday)
  openingHours: {
    "0": { // Sunday
      "is_closed": true,
      "open_time": null,
      "close_time": null
    },
    "1": { // Monday
      "is_closed": false,
      "open_time": "09:00",
      "close_time": "18:00",
      "breaks": [
        {
          "start_time": "12:00",
          "end_time": "13:00",
          "break_type": "lunch"
        }
      ]
    },
    "2": { // Tuesday
      "is_closed": false,
      "open_time": "09:00",
      "close_time": "18:00"
    },
    "3": { // Wednesday
      "is_closed": false,
      "open_time": "09:00",
      "close_time": "18:00"
    },
    "4": { // Thursday
      "is_closed": false,
      "open_time": "09:00",
      "close_time": "18:00"
    },
    "5": { // Friday
      "is_closed": false,
      "open_time": "09:00",
      "close_time": "20:00"
    },
    "6": { // Saturday
      "is_closed": false,
      "open_time": "10:00",
      "close_time": "17:00"
    }
  },
  
  // Special hours for holidays
  specialHours: [
    {
      "date": "2024-12-25", // Christmas
      "is_closed": true,
      "open_time": null,
      "close_time": null,
      "reason": "Christmas Day"
    },
    {
      "date": "2024-12-31", // New Year's Eve
      "is_closed": false,
      "open_time": "10:00",
      "close_time": "15:00",
      "reason": "New Year's Eve - Limited hours"
    }
  ],
  
  timezone: "Asia/Tokyo",
  autoDetectHolidays: true
};

const invalidTestData = {
  openingHours: {
    "1": {
      "is_closed": false,
      "open_time": "25:00", // Invalid time
      "close_time": "18:00"
    }
  }
};

// Test functions
async function testSetPlaceHours(placeId, authToken) {
  console.log('\n=== Testing Set Place Hours ===');
  
  try {
    const response = await fetch(`${API_BASE_URL}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        place_id: placeId,
        opening_hours: testData.openingHours,
        special_hours: testData.specialHours,
        timezone: testData.timezone,
        auto_detect_holidays: testData.autoDetectHolidays
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Successfully set place hours');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Failed to set place hours');
      console.log('Error:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error setting place hours:', error);
    return null;
  }
}

async function testGetPlaceHours(placeId, authToken) {
  console.log('\n=== Testing Get Place Hours ===');
  
  try {
    const response = await fetch(`${API_BASE_URL}/hours?place_id=${placeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Successfully retrieved place hours');
      console.log('Current status - Is Open:', result.is_open_now);
      if (result.next_status_change) {
        console.log('Next status change:', result.next_status_change);
      }
      console.log('Opening Hours:', JSON.stringify(result.opening_hours, null, 2));
    } else {
      console.log('❌ Failed to get place hours');
      console.log('Error:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error getting place hours:', error);
    return null;
  }
}

async function testUpdatePlaceHours(placeId, authToken) {
  console.log('\n=== Testing Update Place Hours ===');
  
  // Update Friday hours to close earlier
  const updatedHours = {
    ...testData.openingHours,
    "5": { // Friday
      "is_closed": false,
      "open_time": "09:00",
      "close_time": "19:00" // Changed from 20:00 to 19:00
    }
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/hours`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        place_id: placeId,
        opening_hours: updatedHours,
        timezone: testData.timezone
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Successfully updated place hours');
      console.log('Updated Friday hours:', result.opening_hours["5"]);
    } else {
      console.log('❌ Failed to update place hours');
      console.log('Error:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error updating place hours:', error);
    return null;
  }
}

async function testValidateOpeningHours(authToken) {
  console.log('\n=== Testing Opening Hours Validation ===');
  
  // Test valid hours
  console.log('\n--- Testing Valid Hours ---');
  try {
    const response = await fetch(`${API_BASE_URL}/hours/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        opening_hours: testData.openingHours,
        special_hours: testData.specialHours,
        check_overlaps: true,
        check_time_format: true,
        check_logical_order: true
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Validation completed');
      console.log('Is Valid:', result.is_valid);
      console.log('Suggestions:', result.suggestions);
      if (result.warnings.length > 0) {
        console.log('Warnings:', result.warnings);
      }
    } else {
      console.log('❌ Validation failed');
      console.log('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error validating hours:', error);
  }
  
  // Test invalid hours
  console.log('\n--- Testing Invalid Hours ---');
  try {
    const response = await fetch(`${API_BASE_URL}/hours/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        opening_hours: invalidTestData.openingHours,
        check_time_format: true
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Validation completed');
      console.log('Is Valid:', result.is_valid);
      console.log('Errors:', result.errors);
    } else {
      console.log('❌ Validation request failed');
      console.log('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error validating invalid hours:', error);
  }
}

async function testCheckHoursConflicts(tripId, authToken) {
  console.log('\n=== Testing Hours Conflicts Check ===');
  
  const targetDate = '2024-12-25'; // Christmas Day (closed in special hours)
  const startTime = '10:00';
  const endTime = '16:00';
  
  try {
    const url = `${API_BASE_URL}/hours/conflicts?trip_id=${tripId}&target_date=${targetDate}&start_time=${startTime}&end_time=${endTime}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Conflicts check completed');
      console.log('Has Conflicts:', result.has_conflicts);
      if (result.has_conflicts) {
        console.log('Conflicts:', result.conflicts);
        console.log('Recommendations:', result.recommendations);
        if (result.alternative_times.length > 0) {
          console.log('Alternative Times:', result.alternative_times);
        }
      }
    } else {
      console.log('❌ Conflicts check failed');
      console.log('Error:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error checking conflicts:', error);
    return null;
  }
}

// Edge case tests
async function testEdgeCases(placeId, authToken) {
  console.log('\n=== Testing Edge Cases ===');
  
  // Test missing place_id
  console.log('\n--- Testing Missing place_id ---');
  try {
    const response = await fetch(`${API_BASE_URL}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        opening_hours: testData.openingHours
        // Missing place_id
      })
    });

    const result = await response.json();
    console.log('Expected error response:', result.error);
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test invalid place_id
  console.log('\n--- Testing Invalid place_id ---');
  try {
    const response = await fetch(`${API_BASE_URL}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        place_id: 'non-existent-place-id',
        opening_hours: testData.openingHours
      })
    });

    const result = await response.json();
    console.log('Expected error response:', result.error);
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test unauthorized access
  console.log('\n--- Testing Unauthorized Access ---');
  try {
    const response = await fetch(`${API_BASE_URL}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Missing Authorization header
      },
      body: JSON.stringify({
        place_id: placeId,
        opening_hours: testData.openingHours
      })
    });

    const result = await response.json();
    console.log('Expected error response:', result.error);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Performance test
async function testPerformance(placeId, authToken) {
  console.log('\n=== Testing Performance ===');
  
  const startTime = Date.now();
  const promises = [];
  
  // Make 5 concurrent requests
  for (let i = 0; i < 5; i++) {
    promises.push(testGetPlaceHours(placeId, authToken));
  }
  
  try {
    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Completed 5 concurrent requests in ${duration}ms`);
    console.log(`Average response time: ${duration / 5}ms`);
  } catch (error) {
    console.error('❌ Performance test failed:', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Opening Hours Management API Tests');
  console.log('='.repeat(50));
  
  // These values need to be provided
  const PLACE_ID = 'your-test-place-id'; // Replace with actual place ID
  const TRIP_ID = 'your-test-trip-id';   // Replace with actual trip ID
  const AUTH_TOKEN = 'your-auth-token';  // Replace with actual auth token
  
  if (PLACE_ID === 'your-test-place-id') {
    console.log('❌ Please update the test script with actual PLACE_ID, TRIP_ID, and AUTH_TOKEN');
    return;
  }
  
  console.log('Test Configuration:');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Place ID:', PLACE_ID);
  console.log('Trip ID:', TRIP_ID);
  console.log('Auth Token:', AUTH_TOKEN ? 'Present' : 'Missing');
  
  try {
    // Run all tests
    await testSetPlaceHours(PLACE_ID, AUTH_TOKEN);
    await testGetPlaceHours(PLACE_ID, AUTH_TOKEN);
    await testUpdatePlaceHours(PLACE_ID, AUTH_TOKEN);
    await testValidateOpeningHours(AUTH_TOKEN);
    await testCheckHoursConflicts(TRIP_ID, AUTH_TOKEN);
    await testEdgeCases(PLACE_ID, AUTH_TOKEN);
    await testPerformance(PLACE_ID, AUTH_TOKEN);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Opening Hours Management API Tests Completed');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testSetPlaceHours,
    testGetPlaceHours,
    testUpdatePlaceHours,
    testValidateOpeningHours,
    testCheckHoursConflicts,
    testEdgeCases,
    testPerformance,
    runTests
  };
}

// Run tests if this script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runTests();
}

// Usage instructions
console.log(`
📋 Usage Instructions:
1. Update the API_BASE_URL with your actual Supabase function URL
2. Replace PLACE_ID, TRIP_ID, and AUTH_TOKEN with actual values
3. Run the script: node test-opening-hours-api.js

📊 Test Coverage:
✅ Set place opening hours (POST /place-management/hours)
✅ Get place opening hours (GET /place-management/hours)
✅ Update place opening hours (PUT /place-management/hours)
✅ Validate opening hours format (POST /place-management/hours/validate)
✅ Check opening hours conflicts (GET /place-management/hours/conflicts)
✅ Edge cases and error handling
✅ Performance testing

🔧 Features Tested:
✅ Regular opening hours (Monday-Sunday)
✅ Special hours for holidays/events
✅ Break times (lunch, maintenance)
✅ Timezone support
✅ Current open/closed status calculation
✅ Next status change prediction
✅ Hours validation and conflict detection
✅ Error handling and security
`);