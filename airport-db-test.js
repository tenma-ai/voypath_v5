// Airport DB API テストファイル
// AirportDB (https://airportdb.io/) のAPIをテストして構造を確認する

console.log('🔍 Testing Airport DB API...\n');

// 複数の方法でAirport DB APIをテストする
async function testAirportDB() {
  const baseUrl = 'https://airportdb.io/api/v1';
  
  console.log('=== 1. 基本的な空港情報取得テスト ===');
  
  // 1. 主要空港のIATAコードで直接取得
  const testAirports = ['NRT', 'HND', 'JFK', 'LAX', 'LHR'];
  
  for (const iata of testAirports) {
    try {
      console.log(`\n--- Testing ${iata} ---`);
      const response = await fetch(`${baseUrl}/airport/${iata}?api_key=YOUR_API_KEY`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${iata}: ${data.name || 'Unknown'}`);
        console.log(`   Location: ${data.municipality || 'Unknown'}, ${data.iso_country || 'Unknown'}`);
        console.log(`   Coordinates: ${data.latitude_deg}, ${data.longitude_deg}`);
        console.log(`   Type: ${data.type || 'Unknown'}`);
        
        // 最初の空港で全カラムを表示
        if (iata === 'NRT') {
          console.log('\n📋 Available columns for NRT:');
          Object.keys(data).forEach(key => {
            console.log(`   ${key}: ${typeof data[key]} = ${data[key]}`);
          });
        }
      } else {
        console.log(`❌ ${iata}: API error ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${iata}: ${error.message}`);
    }
    
    // API rate limit対策
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== 2. 座標による最寄り空港検索テスト ===');
  
  // 2. 座標による検索（Tokyo周辺）
  const testLocations = [
    { name: 'Tokyo Station', lat: 35.6812, lng: 139.7671 },
    { name: 'Yokohama', lat: 35.4437, lng: 139.6380 },
    { name: 'New York Times Square', lat: 40.7580, lng: -73.9855 }
  ];
  
  for (const location of testLocations) {
    try {
      console.log(`\n--- Searching near ${location.name} ---`);
      
      // 座標による検索の場合は違うエンドポイントを使用する可能性
      const searchUrl = `${baseUrl}/airports?lat=${location.lat}&lng=${location.lng}&distance=100`;
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found ${Array.isArray(data) ? data.length : 'unknown'} airports near ${location.name}`);
        
        if (Array.isArray(data) && data.length > 0) {
          const nearest = data[0];
          console.log(`   Nearest: ${nearest.name || nearest.iata_code} (${nearest.iata_code})`);
          console.log(`   Distance: ~${calculateDistance(location.lat, location.lng, nearest.latitude_deg, nearest.longitude_deg).toFixed(1)}km`);
        }
      } else {
        console.log(`❌ Search failed for ${location.name}: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Search error for ${location.name}: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== 3. 代替案：フリーの空港データAPI ===');
  
  // 3. 代替案として他のAPIもテスト
  console.log('\nTesting alternative APIs...');
  
  try {
    // OpenFlights データベース（フリー）
    console.log('\n--- Testing OpenFlights API ---');
    const openFlightsResponse = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
    
    if (openFlightsResponse.ok) {
      const csvData = await openFlightsResponse.text();
      const lines = csvData.split('\n').slice(0, 5); // 最初の5行だけ表示
      
      console.log('✅ OpenFlights data sample:');
      lines.forEach((line, index) => {
        if (line.trim()) {
          const parts = line.split(',');
          console.log(`   ${index + 1}: ${parts[1]?.replace(/"/g, '')} (${parts[4]?.replace(/"/g, '')})`);
        }
      });
      
      console.log('\n📋 OpenFlights CSV format:');
      console.log('   Columns: Airport ID, Name, City, Country, IATA, ICAO, Latitude, Longitude, Altitude, Timezone, DST, Tz database, Type, Source');
    }
  } catch (error) {
    console.log(`❌ OpenFlights error: ${error.message}`);
  }
}

// 距離計算（ハバーサイン公式）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球の半径(km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// テスト実行
testAirportDB().then(() => {
  console.log('\n🏁 Airport DB API testing completed!');
}).catch(error => {
  console.error('❌ Test failed:', error);
});