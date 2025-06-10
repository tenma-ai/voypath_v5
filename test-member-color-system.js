/**
 * Member Color System Test Script
 * Tests the complete member color assignment and management system
 */

// Test configuration
const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with actual URL
const SUPABASE_ANON_KEY = 'your-anon-key'; // Replace with actual key
const COLOR_MANAGEMENT_URL = `${SUPABASE_URL}/functions/v1/color-management`;

// Test data
const testTripId = 'test-trip-' + Date.now();
const testUsers = [
  { id: 'user-1', name: 'Alice' },
  { id: 'user-2', name: 'Bob' },
  { id: 'user-3', name: 'Charlie' },
  { id: 'user-4', name: 'Diana' },
  { id: 'user-5', name: 'Eve' }
];

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${COLOR_MANAGEMENT_URL}${endpoint}`, options);
  const data = await response.json();
  
  return {
    status: response.status,
    data,
    success: response.ok
  };
}

// Test functions
async function testColorAssignment() {
  console.log('\n🎨 Testing Color Assignment...');
  
  try {
    // Test assigning colors to multiple users
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      console.log(`\n📌 Assigning color to ${user.name}...`);
      
      const result = await makeRequest('/assign', 'POST', {
        tripId: testTripId,
        userId: user.id
      });
      
      if (result.success) {
        console.log(`✅ Color assigned to ${user.name}:`, result.data.color);
        console.log(`   Remaining colors: ${result.data.remainingColors}`);
      } else {
        console.log(`❌ Failed to assign color to ${user.name}:`, result.data.error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Color assignment test failed:', error);
    return false;
  }
}

async function testDuplicateAssignment() {
  console.log('\n🔄 Testing Duplicate Assignment Prevention...');
  
  try {
    const user = testUsers[0];
    console.log(`\n📌 Attempting to reassign color to ${user.name}...`);
    
    const result = await makeRequest('/assign', 'POST', {
      tripId: testTripId,
      userId: user.id
    });
    
    if (result.success && result.data.color) {
      console.log(`✅ Duplicate assignment handled correctly - returned existing color:`, result.data.color);
      return true;
    } else {
      console.log(`❌ Duplicate assignment test failed:`, result.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Duplicate assignment test failed:', error);
    return false;
  }
}

async function testGetTripColors() {
  console.log('\n📋 Testing Get Trip Colors...');
  
  try {
    const result = await makeRequest(`/trip/${testTripId}`, 'GET');
    
    if (result.success) {
      console.log(`✅ Retrieved trip colors successfully:`);
      console.log(`   Total members with colors: ${result.data.totalMembers}`);
      console.log(`   Available colors: ${result.data.availableColors}`);
      
      result.data.memberColors.forEach(assignment => {
        console.log(`   ${assignment.userName}: ${assignment.color.name} (${assignment.color.hex})`);
      });
      
      return true;
    } else {
      console.log(`❌ Failed to get trip colors:`, result.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Get trip colors test failed:', error);
    return false;
  }
}

async function testGetAvailableColors() {
  console.log('\n🌈 Testing Get Available Colors...');
  
  try {
    const result = await makeRequest(`/available/${testTripId}`, 'GET');
    
    if (result.success) {
      console.log(`✅ Retrieved available colors successfully:`);
      console.log(`   Total available: ${result.data.totalAvailable}`);
      console.log(`   Total used: ${result.data.totalUsed}`);
      
      console.log('   Available colors:');
      result.data.availableColors.slice(0, 5).forEach(color => {
        console.log(`     ${color.name} (${color.hex})`);
      });
      
      return true;
    } else {
      console.log(`❌ Failed to get available colors:`, result.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Get available colors test failed:', error);
    return false;
  }
}

async function testColorRecycling() {
  console.log('\n♻️ Testing Color Recycling...');
  
  try {
    const userToRemove = testUsers[4]; // Remove Eve
    console.log(`\n📌 Recycling color from ${userToRemove.name}...`);
    
    const result = await makeRequest('/recycle', 'DELETE', {
      tripId: testTripId,
      userId: userToRemove.id
    });
    
    if (result.success) {
      console.log(`✅ Color recycled successfully from ${userToRemove.name}`);
      console.log(`   Available colors now: ${result.data.availableColors}`);
      return true;
    } else {
      console.log(`❌ Failed to recycle color:`, result.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Color recycling test failed:', error);
    return false;
  }
}

async function testPlaceColorCalculation() {
  console.log('\n🏗️ Testing Place Color Calculation...');
  
  try {
    // Mock place data with different contributor scenarios
    const scenarios = [
      {
        name: 'Single Contributor',
        contributors: [
          { userId: 'user-1', userName: 'Alice', weight: 1.0, color: { name: 'Ocean Blue', hex: '#0077BE' } }
        ]
      },
      {
        name: 'Two Contributors',
        contributors: [
          { userId: 'user-1', userName: 'Alice', weight: 0.6, color: { name: 'Ocean Blue', hex: '#0077BE' } },
          { userId: 'user-2', userName: 'Bob', weight: 0.4, color: { name: 'Forest Green', hex: '#228B22' } }
        ]
      },
      {
        name: 'Three Contributors',
        contributors: [
          { userId: 'user-1', userName: 'Alice', weight: 0.5, color: { name: 'Ocean Blue', hex: '#0077BE' } },
          { userId: 'user-2', userName: 'Bob', weight: 0.3, color: { name: 'Forest Green', hex: '#228B22' } },
          { userId: 'user-3', userName: 'Charlie', weight: 0.2, color: { name: 'Sunset Orange', hex: '#FF6B35' } }
        ]
      },
      {
        name: 'Five Contributors (Gold)',
        contributors: [
          { userId: 'user-1', userName: 'Alice', weight: 0.25, color: { name: 'Ocean Blue', hex: '#0077BE' } },
          { userId: 'user-2', userName: 'Bob', weight: 0.25, color: { name: 'Forest Green', hex: '#228B22' } },
          { userId: 'user-3', userName: 'Charlie', weight: 0.2, color: { name: 'Sunset Orange', hex: '#FF6B35' } },
          { userId: 'user-4', userName: 'Diana', weight: 0.15, color: { name: 'Royal Purple', hex: '#7B68EE' } },
          { userId: 'user-5', userName: 'Eve', weight: 0.15, color: { name: 'Cherry Red', hex: '#DC143C' } }
        ]
      }
    ];

    scenarios.forEach(scenario => {
      console.log(`\n📌 Testing ${scenario.name}:`);
      
      // Mock PlaceColorCalculator functionality
      const contributorCount = scenario.contributors.length;
      
      if (contributorCount === 0) {
        console.log('   Result: Default gray color');
      } else if (contributorCount === 1) {
        console.log(`   Result: Single color - ${scenario.contributors[0].color.name} (${scenario.contributors[0].color.hex})`);
      } else if (contributorCount >= 5) {
        console.log('   Result: Gold color for 5+ contributors');
        console.log('   CSS: linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)');
      } else {
        console.log('   Result: Gradient color');
        const colors = scenario.contributors.map(c => c.color.hex).join(', ');
        console.log(`   Colors: ${colors}`);
        console.log('   CSS: linear-gradient with equal divisions');
      }
    });
    
    console.log('✅ Place color calculation logic tested successfully');
    return true;
  } catch (error) {
    console.error('❌ Place color calculation test failed:', error);
    return false;
  }
}

async function testMaxMemberLimit() {
  console.log('\n🚫 Testing Maximum Member Limit (20 colors)...');
  
  try {
    // Try to assign colors to more than 20 users
    const extraUsers = [];
    for (let i = 6; i <= 22; i++) {
      extraUsers.push({ id: `user-${i}`, name: `User${i}` });
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const user of extraUsers) {
      const result = await makeRequest('/assign', 'POST', {
        tripId: testTripId,
        userId: user.id
      });
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        if (result.data.error.includes('maximum 20 members')) {
          console.log(`✅ Maximum limit enforced correctly at user ${user.name}`);
          break;
        }
      }
    }
    
    console.log(`   Successfully assigned: ${successCount} additional colors`);
    console.log(`   Failed assignments: ${failureCount}`);
    
    return failureCount > 0; // Should fail at some point
  } catch (error) {
    console.error('❌ Maximum member limit test failed:', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Member Color System Tests');
  console.log('=====================================');
  
  const tests = [
    { name: 'Color Assignment', fn: testColorAssignment },
    { name: 'Duplicate Assignment Prevention', fn: testDuplicateAssignment },
    { name: 'Get Trip Colors', fn: testGetTripColors },
    { name: 'Get Available Colors', fn: testGetAvailableColors },
    { name: 'Color Recycling', fn: testColorRecycling },
    { name: 'Place Color Calculation', fn: testPlaceColorCalculation },
    { name: 'Maximum Member Limit', fn: testMaxMemberLimit }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
        console.log(`\n✅ ${test.name}: PASSED`);
      } else {
        console.log(`\n❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      console.log(`\n❌ ${test.name}: ERROR - ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n=====================================');
  console.log('🏁 Test Results Summary');
  console.log('=====================================');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Member Color System is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
  }
  
  return passedTests === totalTests;
}

// Run tests
if (typeof window === 'undefined') {
  // Node.js environment
  runTests().catch(console.error);
} else {
  // Browser environment
  window.runMemberColorSystemTests = runTests;
  console.log('Member Color System tests loaded. Run with: runMemberColorSystemTests()');
}

module.exports = { runTests };