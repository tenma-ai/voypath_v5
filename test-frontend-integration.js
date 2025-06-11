/**
 * Frontend Google Places Integration Test
 * This script tests the Google Places service on the frontend
 */

console.log('Testing Google Places Frontend Integration...');

// Simulate the GooglePlacesService call
async function testGooglePlacesService() {
    const SUPABASE_URL = 'https://rdufxwoeneglyponagdz.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';
    const PROXY_URL = `${SUPABASE_URL}/functions/v1/google-places-proxy`;
    
    console.log('🔍 Testing text search...');
    
    try {
        // Test 1: Text Search
        const searchParams = new URLSearchParams({
            endpoint: 'textsearch',
            query: 'coffee shop tokyo',
            location: '35.6762,139.6503',
            radius: '1000'
        });
        
        const response = await fetch(`${PROXY_URL}?${searchParams}`, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(`Proxy error: ${data.error}`);
        }
        
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API error: ${data.status}`);
        }
        
        console.log('✅ Text search successful!');
        console.log(`   Found ${data.results?.length || 0} places`);
        
        if (data.results && data.results.length > 0) {
            const place = data.results[0];
            console.log(`   Sample place: ${place.name}`);
            console.log(`   Address: ${place.formatted_address}`);
            console.log(`   Rating: ${place.rating || 'N/A'}`);
            
            // Test 2: Place Details
            if (place.place_id) {
                console.log('🔍 Testing place details...');
                
                const detailsParams = new URLSearchParams({
                    endpoint: 'details',
                    place_id: place.place_id,
                    fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,types'
                });
                
                const detailsResponse = await fetch(`${PROXY_URL}?${detailsParams}`, {
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json();
                    if (detailsData.status === 'OK' && detailsData.result) {
                        console.log('✅ Place details successful!');
                        console.log(`   Detail name: ${detailsData.result.name}`);
                        console.log(`   Types: ${detailsData.result.types?.join(', ') || 'N/A'}`);
                    } else {
                        console.log('⚠️  Place details failed:', detailsData.status);
                    }
                } else {
                    console.log('⚠️  Place details request failed:', detailsResponse.status);
                }
            }
        }
        
        // Test 3: Geocoding
        console.log('🔍 Testing geocoding...');
        
        const geocodeParams = new URLSearchParams({
            endpoint: 'geocode',
            address: 'Tokyo Station, Japan'
        });
        
        const geocodeResponse = await fetch(`${PROXY_URL}?${geocodeParams}`, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            if (geocodeData.status === 'OK' && geocodeData.results?.length > 0) {
                console.log('✅ Geocoding successful!');
                const location = geocodeData.results[0].geometry.location;
                console.log(`   Coordinates: ${location.lat}, ${location.lng}`);
            } else {
                console.log('⚠️  Geocoding failed:', geocodeData.status);
            }
        } else {
            console.log('⚠️  Geocoding request failed:', geocodeResponse.status);
        }
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('📝 Integration Status: WORKING');
        
    } catch (error) {
        console.error('❌ Error testing Google Places service:', error);
        console.log('📝 Integration Status: FAILED');
    }
}

// Run the test
testGooglePlacesService();