// OpenFlights空港データベーステスト
// 無料で利用可能なOpenFlightsデータを詳しく調査

console.log('🔍 Testing OpenFlights Airport Database...\n');

async function testOpenFlights() {
  try {
    console.log('📥 Downloading OpenFlights airport data...');
    const response = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const csvData = await response.text();
    const lines = csvData.split('\n').filter(line => line.trim());
    
    console.log(`✅ Downloaded ${lines.length} airport records\n`);
    
    // データ構造の解析
    console.log('=== データ構造分析 ===');
    console.log('CSV Columns:');
    console.log('0: Airport ID, 1: Name, 2: City, 3: Country, 4: IATA, 5: ICAO, 6: Latitude, 7: Longitude, 8: Altitude, 9: Timezone, 10: DST, 11: Tz database, 12: Type, 13: Source\n');
    
    // 空港データをパース
    const airports = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.split(',').map(part => part.replace(/"/g, '').trim());
        
        if (parts.length >= 8) {
          airports.push({
            id: parts[0],
            name: parts[1],
            city: parts[2],
            country: parts[3],
            iata: parts[4] || null,
            icao: parts[5] || null,
            latitude: parseFloat(parts[6]) || 0,
            longitude: parseFloat(parts[7]) || 0,
            altitude: parseInt(parts[8]) || 0,
            timezone: parts[9] || null,
            type: parts[12] || null
          });
        }
      }
    }
    
    console.log(`📊 Parsed ${airports.length} valid airport records\n`);
    
    // 主要空港のテスト
    console.log('=== 主要空港の検索テスト ===');
    const majorAirports = ['NRT', 'HND', 'JFK', 'LAX', 'LHR', 'CDG', 'ICN'];
    
    majorAirports.forEach(iata => {
      const airport = airports.find(a => a.iata === iata);
      if (airport) {
        console.log(`✅ ${iata}: ${airport.name}`);
        console.log(`   Location: ${airport.city}, ${airport.country}`);
        console.log(`   Coordinates: ${airport.latitude}, ${airport.longitude}`);
        console.log(`   Type: ${airport.type || 'Unknown'}\n`);
      } else {
        console.log(`❌ ${iata}: Not found\n`);
      }
    });
    
    // 座標による最寄り空港検索のテスト
    console.log('=== 座標による最寄り空港検索テスト ===');
    
    const testLocations = [
      { name: 'Tokyo Station', lat: 35.6812, lng: 139.7671 },
      { name: 'Yokohama', lat: 35.4437, lng: 139.6380 },
      { name: 'New York Times Square', lat: 40.7580, lng: -73.9855 },
      { name: 'Los Angeles Downtown', lat: 34.0522, lng: -118.2437 }
    ];
    
    testLocations.forEach(location => {
      console.log(`--- Searching near ${location.name} ---`);
      
      // 商用空港のみをフィルタ（大きな空港を優先）
      const commercialAirports = airports.filter(a => 
        a.iata && 
        a.iata !== '\\N' && 
        a.iata.length === 3 &&
        Math.abs(a.latitude) > 0 &&
        Math.abs(a.longitude) > 0
      );
      
      // 距離を計算して最寄りを見つける
      const nearbyAirports = commercialAirports
        .map(airport => ({
          ...airport,
          distance: calculateDistance(location.lat, location.lng, airport.latitude, airport.longitude)
        }))
        .filter(airport => airport.distance <= 100) // 100km以内
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3); // 上位3つ
      
      if (nearbyAirports.length > 0) {
        console.log(`✅ Found ${nearbyAirports.length} airports within 100km:`);
        nearbyAirports.forEach((airport, index) => {
          console.log(`   ${index + 1}. ${airport.name} (${airport.iata}) - ${airport.distance.toFixed(1)}km`);
          console.log(`      ${airport.city}, ${airport.country}`);
        });
      } else {
        console.log(`❌ No airports found within 100km`);
      }
      console.log('');
    });
    
    // 統計情報
    console.log('=== 統計情報 ===');
    const withIATA = airports.filter(a => a.iata && a.iata !== '\\N' && a.iata.length === 3);
    const byCountry = airports.reduce((acc, airport) => {
      acc[airport.country] = (acc[airport.country] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`📈 Statistics:`);
    console.log(`   Total airports: ${airports.length}`);
    console.log(`   With IATA codes: ${withIATA.length}`);
    console.log(`   Countries covered: ${Object.keys(byCountry).length}`);
    
    // 上位国
    const topCountries = Object.entries(byCountry)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    console.log(`   Top countries by airport count:`);
    topCountries.forEach(([country, count], index) => {
      console.log(`     ${index + 1}. ${country}: ${count} airports`);
    });
    
    return airports;
    
  } catch (error) {
    console.error('❌ Error testing OpenFlights:', error);
    return [];
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
testOpenFlights().then((airports) => {
  console.log('\n🏁 OpenFlights testing completed!');
  if (airports.length > 0) {
    console.log('\n💡 Recommendation: Use OpenFlights data for airport lookup');
    console.log('   - Free and comprehensive airport database');
    console.log('   - Includes IATA codes, coordinates, and airport names');
    console.log('   - Perfect for nearest airport search functionality');
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
});