interface PixabayPhoto {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  fullHDURL?: string;
  views: number;
  downloads: number;
  favorites: number;
  likes: number;
  user: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayPhoto[];
}

class PixabayService {
  private apiKey: string;
  private baseUrl = 'https://pixabay.com/api/';
  private cache = new Map<string, string>();

  constructor() {
    this.apiKey = import.meta.env.VITE_PIXABAY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('VITE_PIXABAY_API_KEY is not set. Using placeholder images.');
    }
  }

  private async fetchFromPixabay(query: string, page: number = 1, perPage: number = 15): Promise<PixabayResponse> {
    if (!this.apiKey) {
      throw new Error('Pixabay API key not configured');
    }

    const url = `${this.baseUrl}?key=${this.apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&category=places&per_page=${perPage}&page=${page}&safesearch=true`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status}`);
    }

    return response.json();
  }

  async searchPhoto(query: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<string> {
    // If no API key, return fallback immediately
    if (!this.apiKey) {
      console.warn('Pixabay API key not available, using fallback image');
      return this.getFallbackImage();
    }

    try {
      // Clean up query to make it more search-friendly
      const cleanQuery = query
        .replace(/[^\w\s]/g, '') // Remove special characters
        .trim()
        .toLowerCase();

      if (!cleanQuery) {
        console.warn('Empty query after cleaning, using fallback image');
        return this.getFallbackImage();
      }

      // Check cache first
      const cacheKey = `${cleanQuery}_${size}`;
      if (this.cache.has(cacheKey)) {
        console.log(`Using cached image for: ${cleanQuery}`);
        return this.cache.get(cacheKey)!;
      }

      console.log(`Searching Pixabay for: "${cleanQuery}"`);

      // Use consistent parameters for reliable results
      const pageNumber = 1; // Always use first page
      const perPage = 20; // Get more results
      
      const data = await this.fetchFromPixabay(cleanQuery, pageNumber, perPage);
      
      if (data.hits && data.hits.length > 0) {
        // Always select the first photo for consistency
        const photo = data.hits[0];
        
        // Choose appropriate image size based on parameter
        let imageUrl: string;
        switch (size) {
          case 'small':
            imageUrl = photo.previewURL;
            break;
          case 'large':
            imageUrl = photo.largeImageURL;
            break;
          default:
            imageUrl = photo.webformatURL;
        }
        
        console.log(`Found ${data.hits.length} photos for "${cleanQuery}", selected first photo`);
        
        // Cache the result
        this.cache.set(cacheKey, imageUrl);
        
        return imageUrl;
      }

      console.warn(`No photos found for query: "${cleanQuery}"`);
      return this.getFallbackImage();
    } catch (error) {
      console.error('Error fetching photo from Pixabay:', error);
      return this.getFallbackImage();
    }
  }

  async getPlacePhoto(placeName: string): Promise<string> {
    // Extract location name for better search results
    const locationName = this.extractLocationName(placeName);
    return this.searchPhoto(locationName, 'medium');
  }

  private extractLocationName(placeName: string): string {
    // Remove common prefixes and suffixes
    let cleaned = placeName
      .replace(/^(Departure:|Return to Departure:|Destination:)/i, '')
      .replace(/\(.*\)/g, '') // Remove parentheses content like (HND), (Airport codes)
      .replace(/,.*$/, '') // Remove everything after first comma
      .replace(/\s+(Airport|Station|Hotel|Restaurant|Museum|Park|Center|Centre)$/i, '') // Remove common place type suffixes
      .trim();

    // If it's empty after cleaning, use original
    if (!cleaned) {
      cleaned = placeName;
    }

    // Enhance search terms for better results
    if (cleaned.toLowerCase().includes('tokyo')) {
      cleaned = 'tokyo city japan';
    } else if (cleaned.toLowerCase().includes('new york') || cleaned.toLowerCase().includes('nyc')) {
      cleaned = 'new york city';
    } else if (cleaned.toLowerCase().includes('london')) {
      cleaned = 'london city uk';
    } else if (cleaned.toLowerCase().includes('paris')) {
      cleaned = 'paris city france';
    } else if (cleaned.toLowerCase().includes('los angeles') || cleaned.toLowerCase().includes('la')) {
      cleaned = 'los angeles california';
    } else if (cleaned.toLowerCase().includes('wulingyuan')) {
      cleaned = 'zhangjiajie national forest park china';
    } else if (cleaned.toLowerCase().includes('zhangjiajie')) {
      cleaned = 'zhangjiajie national forest park china';
    }

    console.log(`Extracted location name: "${placeName}" -> "${cleaned}"`);
    return cleaned;
  }

  private getFallbackImage(): string {
    // Return a generic travel/destination placeholder image
    return '/api/placeholder/400/300';
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const pixabayService = new PixabayService();