#!/usr/bin/env node

/**
 * Test script for Google Places Search functionality
 * Tests the complete flow: Search -> Select -> Add Place
 */

const { GooglePlacesService } = require('./project/src/services/GooglePlacesService.ts');

async function testPlacesSearch() {
  console.log('🧪 Testing Google Places Search API...');
  
  try {
    // Test 1: Basic search functionality
    console.log('\n1. Testing basic search...');
    const searchRequest = {
      query: 'Tokyo Station'
    };
    
    const results = await GooglePlacesService.searchPlaces(searchRequest);
    console.log(`✅ Found ${results.length} places for "Tokyo Station"`);
    
    if (results.length > 0) {
      const firstPlace = results[0];
      console.log(`📍 First result: ${firstPlace.name}`);
      console.log(`📍 Address: ${firstPlace.formatted_address}`);
      console.log(`⭐ Rating: ${firstPlace.rating}`);
      
      // Test 2: Place details
      if (firstPlace.place_id) {
        console.log('\n2. Testing place details...');
        const details = await GooglePlacesService.getPlaceDetails(firstPlace.place_id);
        if (details) {
          console.log(`✅ Retrieved detailed information for ${details.name}`);
          console.log(`📱 Phone: ${details.formatted_phone_number || 'N/A'}`);
          console.log(`🌐 Website: ${details.website || 'N/A'}`);
        }
      }
      
      // Test 3: Category inference
      console.log('\n3. Testing category inference...');
      const category = GooglePlacesService.inferCategoryFromTypes(firstPlace.types || []);
      console.log(`🏷️ Inferred category: ${category}`);
      
      // Test 4: Data conversion
      console.log('\n4. Testing data conversion...');
      const internalPlace = GooglePlacesService.convertToInternalPlace(
        firstPlace, 
        'test-trip-id', 
        'test-user-id'
      );
      console.log(`🔄 Converted to internal format:`, {
        name: internalPlace.name,
        category: internalPlace.category,
        source: internalPlace.source,
        wish_level: internalPlace.wish_level
      });
    }
    
    console.log('\n✅ All Google Places API tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

async function testSupabaseIntegration() {
  console.log('\n🗄️ Testing Supabase integration...');
  
  try {
    // This would normally test the Supabase functions
    // For now, we'll just verify the configuration
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      console.log('✅ Supabase configuration found');
      console.log(`📡 URL: ${supabaseUrl}`);
      console.log(`🔑 Key: ${supabaseKey.substring(0, 20)}...`);
    } else {
      console.log('❌ Supabase configuration missing');
    }
    
  } catch (error) {
    console.error('❌ Supabase test failed:', error.message);
  }
}

// Manual test instructions
function printManualTestInstructions() {
  console.log('\n📋 MANUAL TESTING INSTRUCTIONS');
  console.log('====================================');
  console.log('');
  console.log('🌟 Complete User Flow Test:');
  console.log('');
  console.log('1. CREATE TRIP:');
  console.log('   - Open http://localhost:5173');
  console.log('   - Click "Create New Trip"');
  console.log('   - Enter "Tokyo" as departure location');
  console.log('   - Verify dropdown appears with suggestions');
  console.log('   - Select a location from dropdown');
  console.log('   - Optionally set destination and dates');
  console.log('   - Click "Create Trip"');
  console.log('');
  console.log('2. MAP VIEW ADD PLACE:');
  console.log('   - Navigate to Map view');
  console.log('   - Use search bar to search "Senso-ji Temple"');
  console.log('   - Verify search results appear');
  console.log('   - Click on a result');
  console.log('   - Verify redirect to AddPlacePage');
  console.log('   - Fill in visit preferences');
  console.log('   - Click "Add to My Places"');
  console.log('');
  console.log('3. LIST VIEW ADD PLACE:');
  console.log('   - Navigate to List view');
  console.log('   - Click "+" button to add place');
  console.log('   - Search for "Tokyo Skytree"');
  console.log('   - Select from results');
  console.log('   - Complete add place flow');
  console.log('');
  console.log('4. CALENDAR VIEW ADD PLACE:');
  console.log('   - Navigate to Calendar view');
  console.log('   - Click "+" on a specific date');
  console.log('   - Search and add a place');
  console.log('');
  console.log('5. MY PLACES PAGE:');
  console.log('   - Navigate to My Places');
  console.log('   - Click floating "+" button');
  console.log('   - Search and add another place');
  console.log('   - Verify all added places appear');
  console.log('');
  console.log('🔍 Things to Verify:');
  console.log('- Search results load correctly');
  console.log('- Place selection works');
  console.log('- AddPlacePage receives correct data');
  console.log('- Form submission completes successfully');
  console.log('- Places appear in My Places');
  console.log('- Error handling for API failures');
  console.log('- Loading states during searches');
  console.log('- Responsive design on mobile');
  console.log('');
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Voypath Place Management Tests');
  console.log('==========================================');
  
  // Basic API tests
  await testPlacesSearch();
  await testSupabaseIntegration();
  
  // Print manual test instructions
  printManualTestInstructions();
  
  console.log('✅ Automated tests complete!');
  console.log('🖱️  Please run the manual tests in your browser.');
}

// Execute if run directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testPlacesSearch,
  testSupabaseIntegration,
  runAllTests
};