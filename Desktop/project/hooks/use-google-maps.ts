import { useLoadScript } from '@react-google-maps/api';
import { detectUserLanguage } from '@/lib/utils/language-detection';
import { Libraries } from '@react-google-maps/api/dist/utils/make-load-script-url';

// Google Maps APIで使用するライブラリ
const libraries: Libraries = ["places", "geometry"];

/**
 * Google Maps APIをロードするカスタムフック
 * 言語を自動検出してロードします
 */
export const useGoogleMaps = () => {
  // ユーザーの言語を検出
  const userLanguage = typeof window !== 'undefined' ? detectUserLanguage() : 'en';
  
  console.log('🌍 Google Maps APIをロード:', { 
    language: userLanguage
  });
  
  // Google Maps APIをロード
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
    language: userLanguage,
    version: "weekly"
  });
  
  return {
    isLoaded,
    loadError,
    language: userLanguage
  };
}; 