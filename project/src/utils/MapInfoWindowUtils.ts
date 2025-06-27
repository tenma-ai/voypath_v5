/**
 * Utility functions for generating enhanced InfoWindow content for MapView
 */

export interface PlaceInfoWindowData {
  placeName: string;
  imageUrl: string;
  category?: string;
  address?: string;
  userInfo: string;
  userColor: string;
  wishLevel: number;
  dateInfo?: string;
  travelInfo?: string;
  duration?: number;
  notes?: string;
  website?: string;
  placeId: string;
}

export class MapInfoWindowUtils {
  /**
   * Generate enhanced InfoWindow content with image and interactive elements
   */
  static generateEnhancedContent(data: PlaceInfoWindowData): string {
    const {
      placeName,
      imageUrl,
      category,
      address,
      userInfo,
      userColor,
      wishLevel,
      dateInfo,
      travelInfo,
      duration,
      notes,
      website,
      placeId
    } = data;

    const wishStars = '⭐'.repeat(Math.min(wishLevel, 5));
    
    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    };

    return `
      <div style="padding: 0; min-width: 320px; max-width: 380px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); font-family: system-ui, -apple-system, sans-serif;">
        <!-- Place Image -->
        <div style="height: 120px; background-image: url('${imageUrl}'); background-size: cover; background-position: center; position: relative;">
          <div style="position: absolute; top: 8px; right: 8px; background: rgba(0, 0, 0, 0.7); border-radius: 6px; padding: 4px 8px;">
            <span style="color: white; font-size: 12px; font-weight: 600;">${category || 'Place'}</span>
          </div>
          ${wishLevel > 0 ? `
            <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(255, 255, 255, 0.9); border-radius: 6px; padding: 4px 8px;">
              <span style="color: #1f2937; font-size: 12px; font-weight: 600;">${wishStars}</span>
            </div>
          ` : ''}
        </div>
        
        <!-- Content -->
        <div style="padding: 16px;">
          <div style="margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937; line-height: 1.2;">${placeName}</h3>
            ${address ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; line-height: 1.3;">${address}</p>` : ''}
          </div>
          
          <!-- Member Info -->
          <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${userColor};"></div>
            <div>
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">Added by</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 500;">${userInfo}</p>
            </div>
          </div>
          
          <!-- Schedule & Duration Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            ${dateInfo ? `
              <div>
                <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Schedule</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #1f2937; font-weight: 500;">${dateInfo}</p>
              </div>
            ` : ''}
            
            ${duration ? `
              <div>
                <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Duration</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #1f2937; font-weight: 500;">${formatDuration(duration)}</p>
              </div>
            ` : ''}
          </div>
          
          ${travelInfo ? `
            <div style="margin-bottom: 12px; padding: 8px; background: #f0f9ff; border-radius: 6px; border-left: 3px solid #3b82f6;">
              <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Next Travel</p>
              <p style="margin: 2px 0 0 0; font-size: 13px; color: #1f2937; font-weight: 500;">${travelInfo}</p>
            </div>
          ` : ''}
          
          ${notes ? `
            <div style="margin-bottom: 12px; padding: 8px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b;">
              <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Notes</p>
              <p style="margin: 2px 0 0 0; font-size: 13px; color: #1f2937; line-height: 1.4;">${notes}</p>
            </div>
          ` : ''}
          
          <!-- Quick Actions -->
          <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <button 
              onclick="if(window.parent && window.parent.handleEditPlace) window.parent.handleEditPlace('${placeId}'); else console.log('Edit place:', '${placeId}');" 
              style="flex: 1; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: background-color 0.2s;"
              onmouseover="this.style.backgroundColor='#2563eb'"
              onmouseout="this.style.backgroundColor='#3b82f6'"
            >
              ✏️ Edit
            </button>
            ${website ? `
              <button 
                onclick="window.open('${website}', '_blank')" 
                style="flex: 1; padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: background-color 0.2s;"
                onmouseover="this.style.backgroundColor='#059669'"
                onmouseout="this.style.backgroundColor='#10b981'"
              >
                🔗 Website
              </button>
            ` : ''}
            <button 
              onclick="if(window.parent && window.parent.handleRemovePlace) window.parent.handleRemovePlace('${placeId}'); else console.log('Remove place:', '${placeId}');" 
              style="padding: 8px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s;"
              onmouseover="this.style.backgroundColor='#dc2626'"
              onmouseout="this.style.backgroundColor='#ef4444'"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate simple InfoWindow content for system places
   */
  static generateSystemPlaceContent(placeName: string, placeType: string): string {
    return `
      <div style="padding: 16px; min-width: 280px; max-width: 350px; border-radius: 8px; font-family: system-ui, -apple-system, sans-serif;">
        <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1f2937;">
          ${placeName}
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">
          ${placeType || 'System Location'}
        </p>
      </div>
    `;
  }
}