/**
 * Airport name mapping utilities for booking system
 * Converts database place names to standardized airport names with IATA codes
 */

export class AirportMappingUtils {
  // Airport name mappings from database format to standard format
  private static readonly AIRPORT_MAPPINGS: { [key: string]: string } = {
    // Tokyo airports
    'hanedakuko': 'Tokyo Haneda International Airport (HND)',
    'haneda': 'Tokyo Haneda International Airport (HND)',
    'tokyo haneda': 'Tokyo Haneda International Airport (HND)',
    'narita': 'Tokyo Narita International Airport (NRT)',
    'tokyo narita': 'Tokyo Narita International Airport (NRT)',
    
    // Beijing airports
    'beijing daxing international airport': 'Beijing Daxing International Airport (PKX)',
    'beijing daxing': 'Beijing Daxing International Airport (PKX)',
    'beijing capital': 'Beijing Capital International Airport (PEK)',
    'beijing capital international airport': 'Beijing Capital International Airport (PEK)',
    
    // Other major airports
    'dalian': 'Dalian Zhoushuizi International Airport (DLC)',
    'zhoushuizi': 'Dalian Zhoushuizi International Airport (DLC)',
    'wulingyuan': 'Dayong Airport (DYG)',
    'dayong': 'Dayong Airport (DYG)',
    'zhangjiajie': 'Dayong Airport (DYG)',
    'shanghai pudong': 'Shanghai Pudong International Airport (PVG)',
    'shanghai hongqiao': 'Shanghai Hongqiao International Airport (SHA)',
    'guangzhou': 'Guangzhou Baiyun International Airport (CAN)',
    'shenzhen': 'Shenzhen Bao\'an International Airport (SZX)',
    'xiamen': 'Xiamen Gaoqi International Airport (XMN)',
    'nanjing': 'Nanjing Lukou International Airport (NKG)',
    'chongqing': 'Chongqing Jiangbei International Airport (CKG)',
    'chengdu': 'Chengdu Shuangliu International Airport (CTU)',
    'xian': 'Xi\'an Xianyang International Airport (XIY)',
    'kunming': 'Kunming Changshui International Airport (KMG)',
    'urumqi': 'Urumqi Diwopu International Airport (URC)'
  };

  // City to airport mappings
  private static readonly CITY_TO_AIRPORT: { [key: string]: string } = {
    'tokyo': 'Tokyo Haneda International Airport (HND)',
    'beijing': 'Beijing Daxing International Airport (PKX)',
    'dalian': 'Dalian Zhoushuizi International Airport (DLC)',
    'wulingyuan': 'Dayong Airport (DYG)',
    'zhangjiajie': 'Dayong Airport (DYG)',
    'shanghai': 'Shanghai Pudong International Airport (PVG)',
    'guangzhou': 'Guangzhou Baiyun International Airport (CAN)',
    'shenzhen': 'Shenzhen Bao\'an International Airport (SZX)',
    'xiamen': 'Xiamen Gaoqi International Airport (XMN)',
    'nanjing': 'Nanjing Lukou International Airport (NKG)',
    'chongqing': 'Chongqing Jiangbei International Airport (CKG)',
    'chengdu': 'Chengdu Shuangliu International Airport (CTU)',
    'xian': 'Xi\'an Xianyang International Airport (XIY)',
    'kunming': 'Kunming Changshui International Airport (KMG)',
    'urumqi': 'Urumqi Diwopu International Airport (URC)'
  };

  /**
   * Normalize a place name from database format to standard airport name
   * @param placeName - Raw place name from database
   * @returns Normalized airport name with IATA code
   */
  static normalizeAirportName(placeName: string): string {
    if (!placeName) return placeName;

    // Clean the place name
    const cleanName = placeName.toLowerCase()
      .replace(/departure:\s*/, '')           // Remove "Departure: " prefix
      .replace(/\s*\(return\)/, '')          // Remove "(Return)" suffix
      .replace(/,.*$/, '')                   // Remove address parts after comma
      .replace(/\s+/g, ' ')                  // Normalize whitespace
      .trim();

    console.log(`🔍 Normalizing airport name: "${placeName}" → "${cleanName}"`);

    // Try exact match first
    if (this.AIRPORT_MAPPINGS[cleanName]) {
      const normalized = this.AIRPORT_MAPPINGS[cleanName];
      console.log(`✅ Found exact airport mapping: "${cleanName}" → "${normalized}"`);
      return normalized;
    }

    // Try partial matching for key words
    for (const [key, value] of Object.entries(this.AIRPORT_MAPPINGS)) {
      if (cleanName.includes(key) || key.includes(cleanName)) {
        console.log(`✅ Found partial airport mapping: "${cleanName}" contains "${key}" → "${value}"`);
        return value;
      }
    }

    // Try city mapping
    for (const [city, airport] of Object.entries(this.CITY_TO_AIRPORT)) {
      if (cleanName.includes(city)) {
        console.log(`✅ Found city mapping: "${cleanName}" contains "${city}" → "${airport}"`);
        return airport;
      }
    }

    // Return original if no mapping found
    console.log(`⚠️ No airport mapping found for: "${placeName}"`);
    return placeName;
  }

  /**
   * Get city name from airport name for reverse search
   * @param airportName - Airport name (potentially with IATA code)
   * @returns City name for flexible search
   */
  static getCityFromAirportName(airportName: string): string | null {
    if (!airportName) return null;

    const airportLower = airportName.toLowerCase();
    
    // Direct city extraction from airport names
    if (airportLower.includes('tokyo') || airportLower.includes('haneda') || airportLower.includes('narita')) {
      return 'Tokyo';
    }
    if (airportLower.includes('beijing') || airportLower.includes('daxing') || airportLower.includes('capital')) {
      return 'Beijing';
    }
    if (airportLower.includes('dalian') || airportLower.includes('zhoushuizi')) {
      return 'Dalian';
    }
    if (airportLower.includes('dayong') || airportLower.includes('zhangjiajie') || airportLower.includes('wulingyuan')) {
      return 'Wulingyuan';
    }
    if (airportLower.includes('shanghai') || airportLower.includes('pudong') || airportLower.includes('hongqiao')) {
      return 'Shanghai';
    }
    if (airportLower.includes('guangzhou') || airportLower.includes('baiyun')) {
      return 'Guangzhou';
    }
    if (airportLower.includes('xiamen') || airportLower.includes('gaoqi')) {
      return 'Xiamen';
    }
    if (airportLower.includes('nanjing') || airportLower.includes('lukou')) {
      return 'Nanjing';
    }
    
    return null;
  }

  /**
   * Check if a place name looks like an airport
   * @param placeName - Place name to check
   * @returns True if the name appears to be an airport
   */
  static isAirportName(placeName: string): boolean {
    if (!placeName) return false;
    
    const nameLower = placeName.toLowerCase();
    return nameLower.includes('airport') || 
           nameLower.includes('空港') || 
           nameLower.includes('机场') ||
           /\([A-Z]{3,4}\)/.test(placeName) ||
           nameLower.includes('international') ||
           nameLower.includes('departure:') ||
           nameLower.includes('(return)');
  }
}