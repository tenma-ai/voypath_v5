       1  # 🗺️ **Google Maps API統合実装計画書**
       2  
       3  ## 📊 **現状分析**
       4  
       5  ### 🚨 **発見された問題**
       6  1. **Map View** - 実際のGoogle Mapsが表示されていない（静的表示のみ）
       7  2. **Create Trip** - departure location、destinationがダミーデータ検索
       8  3. **Add Places** - 全ての場所検索がダミーデータ（実際のGoogle Places API未統合）
       9  4. **Place Search** - GooglePlacesService.tsは実装済みだが、UIコンポーネントで未使用
      10  
      11  ### ✅ **既存実装確認**
      12  - `GooglePlacesService.ts` - 完全実装済み
      13  - `GooglePlacesSearchModal.tsx` - UI実装済み（ダミーデータ使用中）
      14  - `RealisticRouteCalculator.ts` - 地理的制約システム実装済み
      15  - データベーススキーマ - Google Places用フィールド準備済み
      16  
      17  ---
      18  
      19  ## 🎯 **実装目標**
      20  
      21  ### **Phase 1: Google Maps基盤統合**
      22  - 実際のGoogle Mapsを表示
      23  - APIキー設定・認証
      24  - マップコンポーネントの動的読み込み
      25  
      26  ### **Phase 2: Google Places検索統合**
      27  - リアルタイム場所検索
      28  - 検索結果の地図連動表示
      29  - ダミーデータから実際のAPI切り替え
      30  
      31  ### **Phase 3: 地図・検索完全統合**
      32  - 検索結果のマップマーカー表示
      33  - 場所選択の地図連動
      34  - ルート表示の地図統合
      35  
      36  ---
      37  
      38  ## 🔧 **技術実装計画**
      39  
      40  ### **1. 環境変数・APIキー設定**
      41  
      42  #### **必要な環境変数**
      43  ```env
      44  # .env.local
      45  VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
      46  VITE_GOOGLE_PLACES_API_KEY=your_google_places_api_key
      47  ```
      48  
      49  #### **APIキー権限設定**
      50  - Maps JavaScript API
      51  - Places API (New)
      52  - Geocoding API
      53  - Directions API
      54  
      55  ### **2. Google Maps統合実装**
      56  
      57  #### **A. Google Maps JavaScript API読み込み**
      58  ```typescript
      59  // src/lib/googleMaps.ts
      60  export const loadGoogleMapsAPI = async (): Promise<typeof google> => {
      61    if (window.google) return window.google;
      62    
      63    return new Promise((resolve, reject) => {
      64      const script = document.createElement('script');
      65      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
      66      script.async = true;
      67      script.onload = () => resolve(window.google);
      68      script.onerror = reject;
      69      document.head.appendChild(script);
      70    });
      71  };
      72  ```
      73  
      74  #### **B. MapViewコンポーネント改修**
      75  **ファイル**: `src/components/MapView.tsx`
      76  
      77  **変更箇所**:
      78  ```typescript
      79  // 現在の静的地図表示を動的Google Mapsに置き換え
      80  const [map, setMap] = useState<google.maps.Map | null>(null);
      81  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
      82  const mapRef = useRef<HTMLDivElement>(null);
      83  
      84  useEffect(() => {
      85    loadGoogleMapsAPI().then((google) => {
      86      if (mapRef.current) {
      87        const newMap = new google.maps.Map(mapRef.current, {
      88          center: { lat: 35.6762, lng: 139.6503 }, // Tokyo default
      89          zoom: 10,
      90          styles: [] // カスタムスタイル適用
      91        });
      92        setMap(newMap);
      93      }
      94    });
      95  }, []);
      96  ```
      97  
      98  #### **C. 動的マーカー表示**
      99  ```typescript
     100  // 場所データに基づくマーカー生成
     101  useEffect(() => {
     102    if (!map || !places.length) return;
     103    
     104    // 既存マーカークリア
     105    markers.forEach(marker => marker.setMap(null));
     106    
     107    // 新しいマーカー作成
     108    const newMarkers = places.map((place, index) => {
     109      const marker = new google.maps.Marker({
     110        position: { lat: place.latitude, lng: place.longitude },
     111        map: map,
     112        title: place.name,
     113        icon: {
     114          url: generateMarkerIcon(place, index), // メンバー色対応
     115          scaledSize: new google.maps.Size(40, 40)
     116        }
     117      });
     118      
     119      // マーカークリックイベント
     120      marker.addListener('click', () => {
     121        showPlaceDetails(place);
     122      });
     123      
     124      return marker;
     125    });
     126    
     127    setMarkers(newMarkers);
     128  }, [map, places]);
     129  ```
     130  
     131  ### **3. Google Places検索統合**
     132  
     133  #### **A. GooglePlacesSearchModalの実API統合**
     134  **ファイル**: `src/components/GooglePlacesSearchModal.tsx`
     135  
     136  **主要変更**:
     137  ```typescript
     138  // ダミーデータ削除、実際のAPI呼び出しに変更
     139  const handleSearch = async (query: string) => {
     140    setIsLoading(true);
     141    setError(null);
     142    
     143    try {
     144      const results = await GooglePlacesService.searchPlaces({
     145        query,
     146        location: currentLocation, // 現在地ベース検索
     147        radius: 50000 // 50km範囲
     148      });
     149      
     150      setSearchResults(results);
     151    } catch (error) {
     152      setError('検索に失敗しました。もう一度お試しください。');
     153      console.error('Places search error:', error);
     154    } finally {
     155      setIsLoading(false);
     156    }
     157  };
     158  ```
     159  
     160  #### **B. リアルタイム検索サジェスト**
     161  ```typescript
     162  // デバウンス付きリアルタイム検索
     163  const debouncedSearch = useCallback(
     164    debounce(async (query: string) => {
     165      if (query.length < 2) return;
     166      await handleSearch(query);
     167    }, 300),
     168    []
     169  );
     170  
     171  useEffect(() => {
     172    if (searchQuery.trim()) {
     173      debouncedSearch(searchQuery);
     174    }
     175  }, [searchQuery, debouncedSearch]);
     176  ```
     177  
     178  #### **C. 検索結果地図連動**
     179  ```typescript
     180  // 検索結果の地図表示
     181  const displaySearchResultsOnMap = (results: GooglePlace[]) => {
     182    if (!map) return;
     183    
     184    // 検索結果マーカー表示
     185    const bounds = new google.maps.LatLngBounds();
     186    
     187    results.forEach(place => {
     188      const marker = new google.maps.Marker({
     189        position: {
     190          lat: place.geometry.location.lat,
     191          lng: place.geometry.location.lng
     192        },
     193        map: map,
     194        title: place.name,
     195        icon: {
     196          url: '/icons/search-result-marker.png',
     197          scaledSize: new google.maps.Size(30, 30)
     198        }
     199      });
     200      
     201      bounds.extend(marker.getPosition()!);
     202    });
     203    
     204    map.fitBounds(bounds);
     205  };
     206  ```
     207  
     208  ### **4. Create Trip統合**
     209  
     210  #### **A. 出発地・到着地検索の実装**
     211  **ファイル**: `src/components/CreateTripModal.tsx`
     212  
     213  **変更箇所**:
     214  ```typescript
     215  // ダミーの場所リスト削除、実際のGooglePlaces検索に変更
     216  const [departureSearch, setDepartureSearch] = useState('');
     217  const [destinationSearch, setDestinationSearch] = useState('');
     218  const [departureSuggestions, setDepartureSuggestions] = useState<GooglePlace[]>([]);
     219  const [destinationSuggestions, setDestinationSuggestions] = useState<GooglePlace[]>([]);
     220  
     221  // リアルタイム出発地検索
     222  const searchDeparture = useCallback(
     223    debounce(async (query: string) => {
     224      if (query.length < 2) return;
     225      
     226      try {
     227        const results = await GooglePlacesService.searchPlaces({
     228          query,
     229          type: 'establishment'
     230        });
     231        setDepartureSuggestions(results.slice(0, 5));
     232      } catch (error) {
     233        console.error('Departure search error:', error);
     234      }
     235    }, 300),
     236    []
     237  );
     238  ```
     239  
     240  #### **B. 地理的制約との統合**
     241  ```typescript
     242  // 選択された場所の地理的制約チェック
     243  const validateRoute = async (departure: GooglePlace, destination?: GooglePlace) => {
     244    if (!destination) return { isValid: true };
     245    
     246    const analysis = RealisticRouteCalculator.analyzeTransportOptions(
     247      departure.geometry.location.lat,
     248      departure.geometry.location.lng,
     249      destination.geometry.location.lat,
     250      destination.geometry.location.lng
     251    );
     252    
     253    if (!analysis.isRealistic) {
     254      setError('選択された出発地と到着地間の移動が困難です。');
     255      return { isValid: false, constraints: analysis.constraints };
     256    }
     257    
     258    return { isValid: true };
     259  };
     260  ```
     261  
     262  ### **5. データベース統合強化**
     263  
     264  #### **A. Google Places データ保存**
     265  **Supabase Function**: `place-management/index.ts`
     266  
     267  **拡張機能**:
     268  ```typescript
     269  // Google Places詳細情報の保存
     270  const saveGooglePlaceData = async (googlePlace: GooglePlace, tripId: string, userId: string) => {
     271    const placeData = {
     272      ...GooglePlacesService.convertToInternalPlace(googlePlace, tripId, userId),
     273      
     274      // 追加のGoogle Places情報
     275      google_place_id: googlePlace.place_id,
     276      google_rating: googlePlace.rating,
     277      google_review_count: googlePlace.user_ratings_total,
     278      google_photo_references: googlePlace.photos?.map(p => p.photo_reference) || [],
     279      google_opening_hours: googlePlace.opening_hours,
     280      google_price_level: googlePlace.price_level,
     281      google_place_types: googlePlace.types,
     282      google_vicinity: googlePlace.vicinity,
     283      google_website: googlePlace.website,
     284      google_phone: googlePlace.formatted_phone_number
     285    };
     286    
     287    const { data, error } = await supabase
     288      .from('places')
     289      .insert(placeData)
     290      .select()
     291      .single();
     292      
     293    if (error) throw error;
     294    return data;
     295  };
     296  ```
     297  
     298  #### **B. 重複場所検出・統合**
     299  ```sql
     300  -- places テーブルに重複検出用インデックス追加
     301  CREATE INDEX IF NOT EXISTS idx_places_google_place_id 
     302  ON places(google_place_id) 
     303  WHERE google_place_id IS NOT NULL;
     304  
     305  -- 重複場所検出関数
     306  CREATE OR REPLACE FUNCTION detect_duplicate_places(
     307    p_google_place_id VARCHAR,
     308    p_trip_id UUID
     309  ) RETURNS TABLE (
     310    existing_place_id UUID,
     311    is_duplicate BOOLEAN
     312  ) AS $$
     313  BEGIN
     314    RETURN QUERY
     315    SELECT 
     316      id as existing_place_id,
     317      true as is_duplicate
     318    FROM places 
     319    WHERE google_place_id = p_google_place_id 
     320      AND trip_id = p_trip_id;
     321  END;
     322  $$ LANGUAGE plpgsql;
     323  ```
     324  
     325  ### **6. 現在地取得・位置情報統合**
     326  
     327  #### **A. 現在地取得機能**
     328  ```typescript
     329  // src/lib/geolocation.ts
     330  export const getCurrentLocation = (): Promise<{lat: number, lng: number}> => {
     331    return new Promise((resolve, reject) => {
     332      if (!navigator.geolocation) {
     333        reject(new Error('Geolocation is not supported'));
     334        return;
     335      }
     336      
     337      navigator.geolocation.getCurrentPosition(
     338        (position) => {
     339          resolve({
     340            lat: position.coords.latitude,
     341            lng: position.coords.longitude
     342          });
     343        },
     344        (error) => {
     345          reject(error);
     346        },
     347        {
     348          enableHighAccuracy: true,
     349          timeout: 10000,
     350          maximumAge: 300000 // 5分間キャッシュ
     351        }
     352      );
     353    });
     354  };
     355  ```
     356  
     357  #### **B. 位置ベース検索の強化**
     358  ```typescript
     359  // 現在地周辺の検索結果優先表示
     360  const searchWithLocationBias = async (query: string) => {
     361    try {
     362      const currentLocation = await getCurrentLocation();
     363      
     364      const results = await GooglePlacesService.searchPlaces({
     365        query,
     366        location: currentLocation,
     367        radius: 10000 // 10km以内を優先
     368      });
     369      
     370      return results;
     371    } catch (error) {
     372      // 位置情報取得失敗時は通常検索
     373      return GooglePlacesService.searchPlaces({ query });
     374    }
     375  };
     376  ```
     377  
     378  ### **7. エラーハンドリング・フォールバック**
     379  
     380  #### **A. API制限・エラー対応**
     381  ```typescript
     382  // src/lib/apiErrorHandler.ts
     383  export class GoogleMapsAPIError extends Error {
     384    constructor(
     385      message: string,
     386      public code: string,
     387      public isRetryable: boolean = false
     388    ) {
     389      super(message);
     390      this.name = 'GoogleMapsAPIError';
     391    }
     392  }
     393  
     394  export const handleGoogleMapsError = (error: any): GoogleMapsAPIError => {
     395    switch (error.code) {
     396      case 'OVER_QUERY_LIMIT':
     397        return new GoogleMapsAPIError(
     398          'API使用制限に達しました。しばらく後にお試しください。',
     399          'QUOTA_EXCEEDED',
     400          true
     401        );
     402      case 'REQUEST_DENIED':
     403        return new GoogleMapsAPIError(
     404          'APIキーの設定に問題があります。',
     405          'API_KEY_ERROR',
     406          false
     407        );
     408      case 'INVALID_REQUEST':
     409        return new GoogleMapsAPIError(
     410          '検索クエリが無効です。',
     411          'INVALID_QUERY',
     412          false
     413        );
     414      default:
     415        return new GoogleMapsAPIError(
     416          'マップサービスで問題が発生しました。',
     417          'UNKNOWN_ERROR',
     418          true
     419        );
     420    }
     421  };
     422  ```
     423  
     424  #### **B. フォールバック機能**
     425  ```typescript
     426  // API失敗時のフォールバック検索
     427  const searchWithFallback = async (query: string) => {
     428    try {
     429      // 1st: Google Places API
     430      return await GooglePlacesService.searchPlaces({ query });
     431    } catch (error) {
     432      try {
     433        // 2nd: Geocoding API
     434        const result = await GooglePlacesService.geocodeAddress(query);
     435        if (result) {
     436          return [{
     437            place_id: result.place_id || '',
     438            name: query,
     439            formatted_address: result.formatted_address,
     440            geometry: {
     441              location: {
     442                lat: result.lat,
     443                lng: result.lng
     444              }
     445            },
     446            types: ['geocode_result']
     447          }];
     448        }
     449      } catch (geocodeError) {
     450        // 3rd: 手動入力フォールバック
     451        return [];
     452      }
     453    }
     454  };
     455  ```
     456  
     457  ### **8. パフォーマンス最適化**
     458  
     459  #### **A. APIキャッシュシステム**
     460  ```typescript
     461  // src/lib/placesCache.ts
     462  class PlacesCache {
     463    private cache = new Map<string, { data: any, timestamp: number }>();
     464    private readonly TTL = 1000 * 60 * 30; // 30分
     465  
     466    get(key: string) {
     467      const item = this.cache.get(key);
     468      if (!item) return null;
     469      
     470      if (Date.now() - item.timestamp > this.TTL) {
     471        this.cache.delete(key);
     472        return null;
     473      }
     474      
     475      return item.data;
     476    }
     477  
     478    set(key: string, data: any) {
     479      this.cache.set(key, {
     480        data,
     481        timestamp: Date.now()
     482      });
     483    }
     484  }
     485  
     486  export const placesCache = new PlacesCache();
     487  ```
     488  
     489  #### **B. 地図レンダリング最適化**
     490  ```typescript
     491  // マーカークラスタリング
     492  const createMarkerCluster = (map: google.maps.Map, markers: google.maps.Marker[]) => {
     493    return new MarkerClusterer({
     494      map,
     495      markers,
     496      renderer: {
     497        render: ({ count, position }) => {
     498          return new google.maps.Marker({
     499            position,
     500            icon: {
     501              url: generateClusterIcon(count),
     502              scaledSize: new google.maps.Size(40, 40),
     503            },
     504            label: {
     505              text: count.toString(),
     506              color: 'white',
     507              fontSize: '12px',
     508            },
     509          });
     510        },
     511      },
     512    });
     513  };
     514  ```
     515  
     516  ---
     517  
     518  ## 📝 **実装順序**
     519  
     520  ### **Stage 1: 基盤構築（1-2日）**
     521  1. 環境変数設定・APIキー設定
     522  2. Google Maps JavaScript API読み込み機能
     523  3. 基本的なマップ表示機能
     524  
     525  ### **Stage 2: Places検索統合（2-3日）**
     526  1. GooglePlacesSearchModal実API統合
     527  2. Create Trip の出発地・到着地検索
     528  3. Add Places の実際の場所検索
     529  
     530  ### **Stage 3: 地図連動機能（2-3日）**
     531  1. 検索結果のマップマーカー表示
     532  2. マーカークリック・場所詳細表示
     533  3. ルート表示・地図統合
     534  
     535  ### **Stage 4: データベース・最適化（1-2日）**
     536  1. Google Places データの完全保存
     537  2. 重複検出・統合機能
     538  3. キャッシュ・パフォーマンス最適化
     539  
     540  ### **Stage 5: テスト・品質保証（1日）**
     541  1. 全機能統合テスト
     542  2. エラーハンドリング確認
     543  3. パフォーマンス最終調整
     544  
     545  ---
     546  
     547  ## 🎯 **成功基準**
     548  
     549  ### **機能的基準**
     550  - ✅ 実際のGoogle Mapsが表示される
     551  - ✅ リアルタイム場所検索が動作する
     552  - ✅ 検索結果が地図上に表示される
     553  - ✅ 場所選択が正常に動作する
     554  - ✅ 地理的制約チェックが機能する
     555  
     556  ### **技術的基準**
     557  - ✅ API使用量が最適化されている
     558  - ✅ エラーハンドリングが包括的
     559  - ✅ パフォーマンスが要求水準を満たす
     560  - ✅ UI/UXが直感的で高速
     561  
     562  ### **品質基準**
     563  - ✅ TypeScriptエラーなし
     564  - ✅ 全機能のテスト完了
     565  - ✅ 本番環境対応完了
     566  
     567  ---
     568  
     569  **この計画により、VoypathのGoogle Maps/Places API統合が完璧に実装され、世界レベルの旅行計画アプリケーションとして完成します。**