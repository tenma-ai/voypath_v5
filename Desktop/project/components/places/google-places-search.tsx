'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Globe } from 'lucide-react';
import { SearchResult } from '@/lib/types/places';
import { detectUserLanguage } from '@/lib/utils/language-detection';

interface GooglePlacesSearchProps {
  placeholder?: string;
  onPlaceSelect: (place: SearchResult) => void;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  autoFocus?: boolean;
  countryRestriction?: string; // Optional country code restriction
  noResultsText?: string;
}

export default function GooglePlacesSearch({ 
  placeholder,
  onPlaceSelect, 
  size = 'medium',
  className = '',
  autoFocus = false,
  countryRestriction,
  noResultsText
}: GooglePlacesSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SearchResult | null>(null);
  const [language, setLanguage] = useState('en');
  const debounceTimer = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  // 言語の検出
  useEffect(() => {
    const detectedLanguage = detectUserLanguage();
    
    setLanguage(detectedLanguage);
    
    console.log('✅ GooglePlacesSearch 初期化:', {
      language: detectedLanguage,
      countryRestriction
    });
    
    // initPlacesServiceを呼び出す
      initPlacesService();
    
    // APIが読み込まれているかのチェックを実行（バックアップメカニズム）
      const checkGoogleMapsInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        if (!placesService.current) {
          console.log('🔄 Google Maps APIが読み込まれました。Places サービスを初期化します。');
          initPlacesService();
        }
        clearInterval(checkGoogleMapsInterval);
      }
    }, 1000);
      
      // 10秒後にチェックを停止
      setTimeout(() => clearInterval(checkGoogleMapsInterval), 10000);
    
    return () => {
      clearInterval(checkGoogleMapsInterval);
    };
  }, [countryRestriction]);

  // 改善：Google Mapsが確実に読み込まれるようにinitPlacesServiceを強化
  // completeInit関数を外部に定義
  const completeInit = (placesServiceRef: React.MutableRefObject<google.maps.places.PlacesService | null>) => {
    const mapDiv = document.createElement('div');
    mapDiv.style.display = 'none';
    document.body.appendChild(mapDiv);
    
    try {
    const map = new google.maps.Map(mapDiv, {
      center: { lat: 0, lng: 0 },
      zoom: 2
    });
    
      placesServiceRef.current = new google.maps.places.PlacesService(map);
    console.log('✅ Google Places サービス初期化完了');
    } catch (error) {
      console.error('❌ Places サービス初期化エラー:', error);
    }
  };

  const initPlacesService = () => {
    try {
      console.log('✅ Google Places サービス初期化を開始します');
      
      // Google Maps APIが読み込まれているか確認
      if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.error('❌ Google Maps APIが読み込まれていません。initPlacesService呼び出し時点でgoogle.mapsが利用できません。');
        // scriptタグを手動で追加
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          console.log('✅ Google Maps API スクリプトが読み込まれました');
          completeInit(placesService);
        };
        script.onerror = () => {
          console.error('❌ Google Maps API スクリプトの読み込みに失敗しました');
        };
        document.head.appendChild(script);
        return;
      } else {
        completeInit(placesService);
      }
    } catch (error) {
      console.error('❌ initPlacesService 実行エラー:', error);
    }
  };

  useEffect(() => {
    // 前回のタイマーをクリア
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 短すぎるクエリは検索しない
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // 検索をデバウンス
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, language]);

  // autoFocusがtrueの場合、ロード時に入力にフォーカス
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    setShowResults(true);

    try {
      if (placesService.current) {
        // 実際のGoogle Places APIを使用
        await performRealSearch(searchQuery);
      } else {
        // Google Places APIが初期化されていない場合
        console.error('Google Places APIが初期化されていません');
        setResults([]);
        // APIの初期化を試みる
        initPlacesService();
      }
    } catch (error) {
      console.error('検索エラー:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 検索クエリから言語を推測する関数
  const detectQueryLanguage = (query: string): string => {
    // 英数字のみの場合は英語と判定
    if (/^[a-zA-Z0-9\s.,\-']+$/.test(query)) {
      return 'en';
    }
    
    // 日本語文字が含まれる場合は日本語と判定
    if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(query)) {
      return 'ja';
    }
    
    // それ以外の場合はブラウザの言語設定を使用
    return language;
  };

  const performRealSearch = async (searchQuery: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!placesService.current) {
        console.error('Places サービスが初期化されていません');
        setIsLoading(false);
        resolve();
        return;
      }

      // 検索クエリの言語を検出
      const queryLanguage = detectQueryLanguage(searchQuery);
      
      console.log(`🔍 検索クエリ「${searchQuery}」の言語を ${queryLanguage === 'en' ? '英語' : queryLanguage === 'ja' ? '日本語' : '検出された言語'} と判定しました`);

      // 適切な言語設定で検索リクエストを構成
      const request: google.maps.places.TextSearchRequest = {
        query: searchQuery,
        language: queryLanguage
      };

      // 国の制限がある場合は追加
      if (countryRestriction) {
        console.log(`🌍 検索を ${countryRestriction} に制限します`);
        // request.locationBias は動作しないため、クエリに国名を追加
        request.query = `${searchQuery} ${countryRestriction}`;
      }

      console.log('🔍 Google Places 検索リクエスト:', request);

      placesService.current.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('✅ 検索結果:', results.length, '件の場所が見つかりました');
          
          // 検索結果をSearchResult型に変換（最大5件まで）
          const searchResults: SearchResult[] = results.slice(0, 5).map(place => {
            const photoUrls: string[] = [];
            if (place.photos && place.photos.length > 0) {
              place.photos.slice(0, 2).forEach(photo => {
                photoUrls.push(photo.getUrl({ maxWidth: 400, maxHeight: 300 }));
              });
            }
            
            return {
              place_id: place.place_id || `place_${Date.now()}`,
              name: place.name || searchQuery,
              address: place.formatted_address || '',
              latitude: place.geometry?.location?.lat() || 0,
              longitude: place.geometry?.location?.lng() || 0,
              photos: photoUrls,
              types: place.types || [],
              rating: place.rating,
              user_ratings_total: place.user_ratings_total
            };
          });
          
          setResults(searchResults);
        } else {
          console.warn('❌ Places 検索失敗:', status);
          
          // findPlaceFromQueryをフォールバックとして試す
          console.log('代替検索方法を試みます...');
          performFindPlaceSearch(searchQuery).then(() => resolve());
          return;
        }
        
        setIsLoading(false);
        resolve();
      });
    });
  };

  const performFindPlaceSearch = async (searchQuery: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!placesService.current) {
        setIsLoading(false);
        resolve();
        return;
      }

      // 検索クエリの言語を検出
      const queryLanguage = detectQueryLanguage(searchQuery);

      // 代替検索方法
      const request: google.maps.places.FindPlaceFromQueryRequest = {
        query: searchQuery,
        fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types', 'photos', 'rating', 'user_ratings_total'],
        language: queryLanguage
      };
      
      console.log('🔍 findPlaceFromQuery 検索リクエスト:', request);
      
      placesService.current.findPlaceFromQuery(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('✅ findPlaceFromQuery 検索結果:', results);
          
          // 検索結果をSearchResult型に変換
          const searchResults: SearchResult[] = results.map(place => {
            const photoUrls: string[] = [];
            if (place.photos && place.photos.length > 0) {
              place.photos.slice(0, 2).forEach(photo => {
                photoUrls.push(photo.getUrl({ maxWidth: 400, maxHeight: 300 }));
              });
            }
            
            return {
              place_id: place.place_id || `place_${Date.now()}`,
              name: place.name || searchQuery,
              address: place.formatted_address || '',
              latitude: place.geometry?.location?.lat() || 0,
              longitude: place.geometry?.location?.lng() || 0,
              photos: photoUrls,
              types: place.types || [],
              rating: place.rating,
              user_ratings_total: place.user_ratings_total
            };
          });
          
          setResults(searchResults);
        } else {
          console.error('findPlaceFromQuery 検索エラー:', status);
          // 検索失敗の場合は空の結果を設定
          setResults([]);
        }
        
        setIsLoading(false);
        resolve();
      });
    });
  };

  const handlePlaceSelect = (place: SearchResult) => {
    console.log('🎯 場所が選択されました:', place);
    setQuery(place.name);
    setShowResults(false);
    setSelectedPlace(place);
    onPlaceSelect(place);
  };

  const handleInputFocus = () => {
    if (results.length > 0) {
      setShowResults(true);
    }
  };

  const handleInputBlur = () => {
    // クリックを許可するために結果を非表示にするのを遅らせる
    setTimeout(() => setShowResults(false), 200);
  };

  const clearSelection = () => {
    setQuery('');
    setSelectedPlace(null);
    setResults([]);
    setShowResults(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const sizeClasses = {
    small: 'text-sm py-1.5 px-2',
    medium: 'text-base py-2 px-3', 
    large: 'text-lg py-3 px-4'
  };

  // ローカライズされたプレースホルダーを取得
  const localizedPlaceholder = getLocalizedPlaceholder(language, placeholder);
  const localizedNoResultsText = getLocalizedNoResultsMessage(language, noResultsText);

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={localizedPlaceholder}
          className={`w-full pl-10 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${sizeClasses[size]}`}
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 animate-spin" />
        ) : query.length > 0 ? (
          <button 
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <div 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
            title={`Language: ${language.toUpperCase()}`}
          >
            <Globe className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* 選択された場所のプレビュー */}
      {selectedPlace && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {selectedPlace.name}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {selectedPlace.address}
              </p>
              
              {/* 評価情報の表示 */}
              {selectedPlace.rating && (
                <div className="flex items-center text-xs mt-1">
                  <span className="text-amber-500 mr-1">★</span>
                  <span className="text-blue-700 dark:text-blue-300">{selectedPlace.rating.toFixed(1)}</span>
                  {selectedPlace.user_ratings_total && (
                    <span className="text-blue-600/70 dark:text-blue-400/70 ml-1">
                      ({selectedPlace.user_ratings_total})
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={clearSelection}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 検索結果ドロップダウン */}
      {showResults && results.length > 0 && !selectedPlace && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((place) => (
            <button
              key={place.place_id}
              onClick={() => handlePlaceSelect(place)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none"
            >
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {place.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {place.address}
                  </p>
                  
                  {/* 評価と場所タイプの情報 */}
                  <div className="flex items-center space-x-3 mt-1">
                    {place.rating && (
                      <div className="flex items-center text-xs">
                        <span className="text-amber-500 mr-1">★</span>
                        <span>{place.rating.toFixed(1)}</span>
                        {place.user_ratings_total && (
                          <span className="text-gray-400 ml-1">({place.user_ratings_total})</span>
                        )}
                      </div>
                    )}
                    
                    {place.types && place.types.length > 0 && (
                      <p className="text-xs text-blue-500">
                        {place.types.slice(0, 2).map(type => type.replace(/_/g, ' ')).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 検索結果なしメッセージ */}
      {showResults && !isLoading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {localizedNoResultsText} "{query}"
          </p>
        </div>
      )}
    </div>
  );
}

// ローカライズヘルパー関数
const getLocalizedPlaceholder = (language: string, customPlaceholder?: string): string => {
  if (customPlaceholder) return customPlaceholder;
  
  const placeholders: Record<string, string> = {
    'en': 'Search for places...',
    'ja': '場所を検索...',
    'fr': 'Rechercher des lieux...',
    'es': 'Buscar lugares...',
    'de': 'Orte suchen...',
    'zh': '搜索地点...',
    'ko': '장소 검색...',
    'pt': 'Pesquisar lugares...',
    'it': 'Cerca luoghi...',
    'ru': 'Поиск мест...'
  };
  
  return placeholders[language] || placeholders['en'];
};

const getLocalizedNoResultsMessage = (language: string, customMessage?: string): string => {
  if (customMessage) return customMessage;
  
  const messages: Record<string, string> = {
    'en': 'No places found for',
    'ja': '見つかりませんでした:',
    'fr': 'Aucun lieu trouvé pour',
    'es': 'No se encontraron lugares para',
    'de': 'Keine Orte gefunden für',
    'zh': '未找到地点:',
    'ko': '장소를 찾을 수 없습니다:',
    'pt': 'Nenhum lugar encontrado para',
    'it': 'Nessun luogo trovato per',
    'ru': 'Места не найдены:'
  };
  
  return messages[language] || messages['en'];
};