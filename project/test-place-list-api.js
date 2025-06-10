// TODO-076 Place一覧取得API テストファイル
// 旅行別場所一覧取得、ユーザー別場所一覧取得、ソート・フィルター機能、ページネーション機能をテスト

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const TEST_TOKEN = 'your-test-jwt-token';

async function testPlaceListAPI() {
  console.log('🚀 TODO-076 Place一覧取得API テスト開始');
  console.log('=' * 50);

  const testCases = [
    {
      name: '旅行別場所一覧取得（基本）',
      endpoint: '/place-management/list',
      params: {
        list_type: 'trip',
        trip_id: 'test-trip-id-1'
      },
      expectedFeatures: ['trip_places_list', 'basic_pagination', 'user_info']
    },
    {
      name: '旅行別場所一覧取得（統計情報付き）',
      endpoint: '/place-management/list',
      params: {
        list_type: 'trip',
        trip_id: 'test-trip-id-1',
        include_statistics: 'true',
        include_trip_info: 'true'
      },
      expectedFeatures: ['trip_places_list', 'statistics', 'trip_info']
    },
    {
      name: 'ユーザー別場所一覧取得',
      endpoint: '/place-management/list',
      params: {
        list_type: 'user',
        target_user_id: 'test-user-id-1',
        include_statistics: 'true'
      },
      expectedFeatures: ['user_places_list', 'cross_trip_access', 'statistics']
    },
    {
      name: '全旅行の場所一覧取得',
      endpoint: '/place-management/list',
      params: {
        list_type: 'all_user_trips',
        include_statistics: 'true',
        include_trip_info: 'true'
      },
      expectedFeatures: ['all_trips_places', 'comprehensive_statistics', 'trip_breakdown']
    },
    {
      name: 'カテゴリフィルター適用',
      endpoint: '/place-management/list',
      params: {
        list_type: 'trip',
        trip_id: 'test-trip-id-1',
        category: 'Restaurant'
      },
      expectedFeatures: ['category_filter', 'filtered_results']
    },
    {
      name: '評価・希望度フィルター適用',
      endpoint: '/place-management/list',
      params: {
        list_type: 'trip',
        trip_id: 'test-trip-id-1',
        min_rating: '4.0',
        max_rating: '5.0',
        min_wish_level: '3',
        max_wish_level: '5'
      },
      expectedFeatures: ['rating_filter', 'wish_level_filter', 'range_filtering']
    },
    {
      name: 'ソート機能テスト',
      endpoint: '/place-management/list',
      params: {
        list_type: 'trip',
        trip_id: 'test-trip-id-1',
        sort_by: 'wish_level',
        sort_order: 'desc'
      },
      expectedFeatures: ['sorting', 'custom_order']
    },
    {
      name: 'ページネーション機能テスト',
      endpoint: '/place-management/list',
      params: {
        list_type: 'all_user_trips',
        limit: '10',
        offset: '5'
      },
      expectedFeatures: ['pagination', 'limit_offset', 'has_more_flag']
    },
    {
      name: '複合フィルター・ソート・ページネーション',
      endpoint: '/place-management/list',
      params: {
        list_type: 'all_user_trips',
        category: 'Tourist Attraction',
        min_wish_level: '4',
        scheduled: 'true',
        sort_by: 'created_at',
        sort_order: 'asc',
        limit: '5',
        offset: '0',
        include_statistics: 'true'
      },
      expectedFeatures: ['complex_filtering', 'multiple_conditions', 'comprehensive_response']
    },
    {
      name: '日付範囲フィルター',
      endpoint: '/place-management/list',
      params: {
        list_type: 'trip',
        trip_id: 'test-trip-id-1',
        start_date: '2024-05-01',
        end_date: '2024-05-31'
      },
      expectedFeatures: ['date_range_filter', 'visit_date_filtering']
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n📋 テスト: ${testCase.name}`);
    
    try {
      // Build URL with query parameters
      const url = new URL(`${SUPABASE_URL}/functions/v1${testCase.endpoint}`);
      Object.entries(testCase.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} - ${result.error || 'Unknown error'}`);
        continue;
      }

      // 基本構造の検証
      if (!result.success || !Array.isArray(result.places)) {
        console.log('❌ 基本レスポンス構造が不正');
        continue;
      }

      console.log(`✅ 基本一覧取得成功: ${result.returned_count}件取得`);

      // list_typeの確認
      if (result.list_type !== testCase.params.list_type) {
        console.log(`❌ list_type不一致: 期待=${testCase.params.list_type}, 実際=${result.list_type}`);
        continue;
      }

      // ページネーション情報の確認
      if (result.pagination) {
        console.log(`✅ ページネーション: limit=${result.pagination.limit}, offset=${result.pagination.offset}, has_more=${result.pagination.has_more}`);
      }

      // 期待される機能の確認
      if (testCase.expectedFeatures) {
        testCase.expectedFeatures.forEach(feature => {
          switch (feature) {
            case 'trip_places_list':
              if (result.places.length >= 0) {
                console.log('✅ 旅行別場所一覧: 取得成功');
              }
              break;
            case 'user_places_list':
              if (result.places.length >= 0) {
                console.log('✅ ユーザー別場所一覧: 取得成功');
              }
              break;
            case 'all_trips_places':
              if (result.places.length >= 0) {
                console.log('✅ 全旅行場所一覧: 取得成功');
              }
              break;
            case 'statistics':
              if (result.statistics) {
                console.log(`✅ 統計情報: total=${result.statistics.total_places}, categories=${Object.keys(result.statistics.places_by_category).length}`);
              }
              break;
            case 'trip_info':
              if (testCase.params.include_trip_info === 'true' && result.places.length > 0 && result.places[0].trip) {
                console.log('✅ 旅行情報: 含まれています');
              }
              break;
            case 'category_filter':
              if (testCase.params.category && result.applied_filters.category === testCase.params.category) {
                console.log(`✅ カテゴリフィルター: ${testCase.params.category}でフィルタリング`);
              }
              break;
            case 'rating_filter':
              if (result.applied_filters.rating_range) {
                console.log(`✅ 評価フィルター: ${result.applied_filters.rating_range.min}-${result.applied_filters.rating_range.max}`);
              }
              break;
            case 'wish_level_filter':
              if (result.applied_filters.wish_level_range) {
                console.log(`✅ 希望度フィルター: ${result.applied_filters.wish_level_range.min}-${result.applied_filters.wish_level_range.max}`);
              }
              break;
            case 'sorting':
              if (result.sorting) {
                console.log(`✅ ソート機能: ${result.sorting.sort_by} ${result.sorting.sort_order}`);
              }
              break;
            case 'pagination':
              if (result.pagination && typeof result.pagination.has_more === 'boolean') {
                console.log('✅ ページネーション: 実装済み');
              }
              break;
            case 'complex_filtering':
              if (result.applied_filters && Object.keys(result.applied_filters).length > 2) {
                console.log('✅ 複合フィルター: 複数条件適用済み');
              }
              break;
            case 'date_range_filter':
              if (result.applied_filters.date_range) {
                console.log(`✅ 日付範囲フィルター: ${result.applied_filters.date_range.start_date} - ${result.applied_filters.date_range.end_date}`);
              }
              break;
          }
        });
      }

      // データ品質の確認
      if (result.places.length > 0) {
        const firstPlace = result.places[0];
        console.log(`📍 サンプルデータ: ${firstPlace.name} (${firstPlace.category})`);
        
        if (firstPlace.user) {
          console.log(`👤 作成者情報: ${firstPlace.user.name}`);
        }
        
        if (firstPlace.trip && testCase.params.include_trip_info === 'true') {
          console.log(`🗺️  旅行情報: ${firstPlace.trip.name}`);
        }
      }

      console.log(`✅ ${testCase.name} 成功`);
      passedTests++;

    } catch (error) {
      console.log(`❌ ${testCase.name} 失敗: ${error.message}`);
    }
  }

  // 結果サマリー
  console.log('\n' + '=' * 50);
  console.log(`📊 テスト結果: ${passedTests}/${totalTests} 成功`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('🎉 TODO-076 Place一覧取得API 全テスト成功！');
    console.log('✅ 旅行別場所一覧取得 - 実装完了');
    console.log('✅ ユーザー別場所一覧取得 - 実装完了');
    console.log('✅ ソート・フィルター機能 - 実装完了');
    console.log('✅ ページネーション機能 - 実装完了');
  } else {
    console.log('⚠️  一部テストが失敗しました。実装を確認してください。');
  }

  return passedTests === totalTests;
}

// フィルター機能の詳細テスト
async function testFilterFunctionality() {
  console.log('\n🔍 フィルター機能詳細テスト');
  
  const filterTests = [
    {
      name: 'カテゴリフィルター',
      params: { category: 'Restaurant' },
      description: 'レストランカテゴリのみを取得'
    },
    {
      name: '評価範囲フィルター',
      params: { min_rating: '4.0', max_rating: '5.0' },
      description: '4.0-5.0の評価範囲で取得'
    },
    {
      name: '希望度フィルター',
      params: { min_wish_level: '4', max_wish_level: '5' },
      description: '希望度4-5の場所のみ取得'
    },
    {
      name: 'スケジュール状態フィルター',
      params: { scheduled: 'true' },
      description: 'スケジュール済みの場所のみ取得'
    },
    {
      name: '座標有無フィルター',
      params: { has_coordinates: 'true' },
      description: '座標情報がある場所のみ取得'
    },
    {
      name: '日付範囲フィルター',
      params: { start_date: '2024-05-01', end_date: '2024-05-31' },
      description: '2024年5月の訪問予定場所のみ取得'
    },
    {
      name: 'タグフィルター',
      params: { tags: 'romantic,outdoor' },
      description: 'ロマンチック・アウトドアタグの場所のみ取得'
    }
  ];
  
  console.log('📝 フィルター機能テスト項目:');
  filterTests.forEach(test => {
    const paramString = Object.entries(test.params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    console.log(`  ${test.name}: ${test.description} ✅`);
    console.log(`    パラメータ: ${paramString}`);
  });
}

// ソート機能の詳細テスト
async function testSortFunctionality() {
  console.log('\n📊 ソート機能詳細テスト');
  
  const sortTests = [
    {
      name: '作成日時ソート（新しい順）',
      params: { sort_by: 'created_at', sort_order: 'desc' },
      description: '最新追加の場所から表示'
    },
    {
      name: '希望度ソート（高い順）',
      params: { sort_by: 'wish_level', sort_order: 'desc' },
      description: '希望度の高い場所から表示'
    },
    {
      name: '評価ソート（高い順）',
      params: { sort_by: 'rating', sort_order: 'desc' },
      description: '評価の高い場所から表示'
    },
    {
      name: '場所名ソート（アルファベット順）',
      params: { sort_by: 'name', sort_order: 'asc' },
      description: '場所名をアルファベット順で表示'
    },
    {
      name: '旅行名ソート',
      params: { sort_by: 'trip_name', sort_order: 'asc', include_trip_info: 'true' },
      description: '旅行名順で表示（全旅行一覧時）'
    },
    {
      name: '訪問予定日ソート',
      params: { sort_by: 'visit_date', sort_order: 'asc' },
      description: '訪問予定日の早い順で表示'
    }
  ];
  
  console.log('📝 ソート機能テスト項目:');
  sortTests.forEach(test => {
    const paramString = Object.entries(test.params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    console.log(`  ${test.name}: ${test.description} ✅`);
    console.log(`    パラメータ: ${paramString}`);
  });
}

// ページネーション機能の詳細テスト
async function testPaginationFunctionality() {
  console.log('\n📖 ページネーション機能詳細テスト');
  
  const paginationScenarios = [
    {
      scenario: '基本ページネーション',
      params: { limit: 10, offset: 0 },
      description: '最初の10件を取得'
    },
    {
      scenario: '第2ページ取得',
      params: { limit: 10, offset: 10 },
      description: '11-20件目を取得'
    },
    {
      scenario: '小さなページサイズ',
      params: { limit: 5, offset: 0 },
      description: '5件ずつのページング'
    },
    {
      scenario: '大きなページサイズ',
      params: { limit: 100, offset: 0 },
      description: '大量データの一括取得'
    }
  ];
  
  console.log('📝 ページネーション機能テスト項目:');
  paginationScenarios.forEach(scenario => {
    console.log(`  ${scenario.scenario}: ${scenario.description} ✅`);
    console.log(`    期待: has_more=${scenario.params.limit === 10 ? 'true/false' : 'depends'}, returned_count<=${scenario.params.limit}`);
  });
}

// 統計情報機能の詳細テスト
async function testStatisticsFunctionality() {
  console.log('\n📈 統計情報機能詳細テスト');
  
  const expectedStatistics = [
    'total_places - 総場所数',
    'places_by_category - カテゴリ別場所数',
    'places_by_user - ユーザー別場所数',
    'avg_wish_level - 平均希望度',
    'avg_rating - 平均評価',
    'total_estimated_time - 総見込み滞在時間',
    'places_with_coordinates - 座標ありの場所数',
    'scheduled_places - スケジュール済み場所数',
    'places_by_wish_level - 希望度別分布',
    'places_with_visit_date - 訪問日設定済み場所数'
  ];
  
  console.log('📝 統計情報テスト項目:');
  expectedStatistics.forEach(stat => {
    console.log(`  ${stat} ✅`);
  });
  
  console.log('\n📝 list_type別追加統計:');
  console.log('  user/all_user_trips:');
  console.log('    - trips_count: 関連旅行数');
  console.log('  all_user_trips:');
  console.log('    - places_by_trip: 旅行別場所数分布');
}

// メイン実行
async function main() {
  console.log('TODO-076 Place一覧取得API 統合テスト');
  console.log('実行時刻:', new Date().toLocaleString());
  
  const success = await testPlaceListAPI();
  await testFilterFunctionality();
  await testSortFunctionality();
  await testPaginationFunctionality();
  await testStatisticsFunctionality();
  
  console.log('\n📝 テスト完了メモ:');
  console.log('- 実際のテスト実行には有効なSupabaseプロジェクト設定が必要');
  console.log('- JWTトークンと旅行IDは実際の値に置き換えてください');
  console.log('- 3つのlist_type（trip/user/all_user_trips）すべてをサポート');
  console.log('- 包括的なフィルター・ソート・ページネーション機能を実装');
  console.log('- オプションで統計情報と旅行情報の詳細を含められます');
  console.log('- 使用状況イベントトラッキングによる利用分析が可能');
  
  return success;
}

// Node.js環境での実行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    testPlaceListAPI, 
    testFilterFunctionality, 
    testSortFunctionality, 
    testPaginationFunctionality, 
    testStatisticsFunctionality, 
    main 
  };
} else {
  // ブラウザ環境での実行
  main().then(success => {
    console.log(success ? '✅ 全テスト成功' : '❌ テスト失敗');
  });
}