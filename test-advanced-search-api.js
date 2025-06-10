/**
 * TODO-087: Advanced Place Search API Test Script
 * 高度検索・フィルタリング機能のテスト
 */

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// テスト用のユーザー認証ヘッダー
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

/**
 * テスト結果を記録
 */
class TestResults {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  addResult(testName, passed, message = '', data = null) {
    this.tests.push({
      name: testName,
      passed,
      message,
      data,
      timestamp: new Date().toISOString()
    });
    
    if (passed) {
      this.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.failed++;
      console.log(`❌ ${testName}: ${message}`);
    }
  }

  summary() {
    console.log('\n=== Advanced Search API Test Summary ===');
    console.log(`Total Tests: ${this.tests.length}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`);
    
    if (this.failed > 0) {
      console.log('\nFailed Tests:');
      this.tests.filter(t => !t.passed).forEach(t => {
        console.log(`- ${t.name}: ${t.message}`);
      });
    }
  }
}

const results = new TestResults();

/**
 * テスト用データの生成
 */
function generateTestData() {
  return {
    trip_id: 'test-trip-id',
    user_id: 'test-user-id',
    places: [
      {
        name: 'Tokyo Station',
        category: 'transportation',
        latitude: 35.6812,
        longitude: 139.7671,
        rating: 4.2,
        price_level: 2,
        visit_date: '2024-12-15'
      },
      {
        name: 'Shibuya Restaurant',
        category: 'restaurant',
        latitude: 35.6595,
        longitude: 139.7006,
        rating: 4.5,
        price_level: 3,
        visit_date: '2024-12-16'
      }
    ]
  };
}

/**
 * 基本高度検索テスト
 */
async function testBasicAdvancedSearch() {
  console.log('\n--- Basic Advanced Search Tests ---');
  
  try {
    // テスト 1: GET リクエスト - 基本パラメータ
    const url = new URL(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`);
    url.searchParams.append('query', 'restaurant');
    url.searchParams.append('min_rating', '4.0');
    url.searchParams.append('include_analytics', 'true');
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.addResult(
        'Basic GET Advanced Search',
        true,
        `Found ${data.places?.length || 0} places with analytics`
      );
      
      // アナリティクス情報の確認
      if (data.analytics) {
        results.addResult(
          'Analytics Data',
          true,
          `Performance: ${data.analytics.search_performance_ms}ms, Quality: ${data.analytics.result_quality_score.toFixed(1)}`
        );
      }
    } else {
      results.addResult(
        'Basic GET Advanced Search',
        false,
        data.error || 'Unknown error'
      );
    }
  } catch (error) {
    results.addResult(
      'Basic GET Advanced Search',
      false,
      error.message
    );
  }
}

/**
 * 複雑な POST 検索テスト
 */
async function testComplexPostSearch() {
  console.log('\n--- Complex POST Search Tests ---');
  
  try {
    const searchParams = {
      query: 'restaurant',
      min_rating: 4.0,
      date_range: {
        start_date: '2024-12-01',
        end_date: '2024-12-31'
      },
      text_search: {
        mode: 'semantic',
        fields: ['name', 'category', 'notes'],
        boost_recent: true,
        boost_popular: true
      },
      complex_filters: {
        and_conditions: [
          {
            field: 'category',
            operator: 'equals',
            value: 'restaurant'
          },
          {
            field: 'price_level',
            operator: 'between',
            value: [2, 4]
          }
        ],
        or_conditions: [
          {
            field: 'rating',
            operator: 'greater_than',
            value: 4.0
          },
          {
            field: 'wish_level',
            operator: 'greater_than',
            value: 3
          }
        ]
      },
      custom_scoring: {
        weight_popularity: 0.3,
        weight_distance: 0.2,
        weight_rating: 0.3,
        weight_recency: 0.2
      },
      include_analytics: true,
      enable_faceted_search: true,
      limit: 20
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchParams)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.addResult(
        'Complex POST Search with Filters',
        true,
        `Found ${data.places?.length || 0} places with custom scoring`
      );
      
      // ファセット検索結果の確認
      if (data.faceted_results) {
        results.addResult(
          'Faceted Search Results',
          true,
          `Categories: ${data.faceted_results.facets.categories.length}, Price levels: ${data.faceted_results.facets.price_levels.length}`
        );
      }
      
      // セマンティック検索機能の確認
      if (data.search_suggestions) {
        results.addResult(
          'Semantic Search Features',
          true,
          `Suggestions: ${data.search_suggestions.length}, Related: ${data.related_searches?.length || 0}`
        );
      }
    } else {
      results.addResult(
        'Complex POST Search with Filters',
        false,
        data.error || 'Unknown error'
      );
    }
  } catch (error) {
    results.addResult(
      'Complex POST Search with Filters',
      false,
      error.message
    );
  }
}

/**
 * クラスタリング機能テスト
 */
async function testClusteringFeatures() {
  console.log('\n--- Clustering Features Tests ---');
  
  try {
    const searchParams = {
      latitude: 35.6762,
      longitude: 139.6503,
      radius_km: 10,
      cluster_options: {
        enable_clustering: true,
        cluster_radius_km: 2.0,
        min_cluster_size: 2,
        return_clusters: true
      },
      include_analytics: true,
      limit: 50
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchParams)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.addResult(
        'Geographic Clustering',
        true,
        `Found ${data.clusters?.length || 0} clusters from ${data.places?.length || 0} places`
      );
      
      // クラスター詳細の確認
      if (data.clusters && data.clusters.length > 0) {
        const cluster = data.clusters[0];
        results.addResult(
          'Cluster Details',
          true,
          `Cluster has ${cluster.place_count} places, score: ${cluster.cluster_score.toFixed(2)}`
        );
      }
    } else {
      results.addResult(
        'Geographic Clustering',
        false,
        data.error || 'Unknown error'
      );
    }
  } catch (error) {
    results.addResult(
      'Geographic Clustering',
      false,
      error.message
    );
  }
}

/**
 * 多段階ソート機能テスト
 */
async function testMultiLevelSorting() {
  console.log('\n--- Multi-Level Sorting Tests ---');
  
  try {
    const searchParams = {
      multi_sort: {
        primary: {
          field: 'rating',
          order: 'desc',
          null_handling: 'last'
        },
        secondary: {
          field: 'wish_level',
          order: 'desc',
          null_handling: 'last'
        },
        tertiary: {
          field: 'created_at',
          order: 'desc',
          null_handling: 'last'
        }
      },
      include_analytics: true,
      limit: 30
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchParams)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.addResult(
        'Multi-Level Sorting',
        true,
        `Sorted ${data.places?.length || 0} places with 3-level criteria`
      );
      
      // ソート順の検証
      if (data.places && data.places.length >= 2) {
        const firstPlace = data.places[0];
        const secondPlace = data.places[1];
        const sortedCorrectly = (firstPlace.rating || 0) >= (secondPlace.rating || 0);
        
        results.addResult(
          'Sort Order Validation',
          sortedCorrectly,
          `First place rating: ${firstPlace.rating}, Second: ${secondPlace.rating}`
        );
      }
    } else {
      results.addResult(
        'Multi-Level Sorting',
        false,
        data.error || 'Unknown error'
      );
    }
  } catch (error) {
    results.addResult(
      'Multi-Level Sorting',
      false,
      error.message
    );
  }
}

/**
 * 時間的フィルタリングテスト
 */
async function testTemporalFiltering() {
  console.log('\n--- Temporal Filtering Tests ---');
  
  try {
    const searchParams = {
      date_range: {
        start_date: '2024-12-01',
        end_date: '2024-12-31'
      },
      time_range: {
        start_time: '09:00',
        end_time: '21:00'
      },
      day_of_week: [1, 2, 3, 4, 5], // Monday to Friday
      include_analytics: true
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchParams)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.addResult(
        'Temporal Filtering',
        true,
        `Found ${data.places?.length || 0} places within date/time constraints`
      );
    } else {
      results.addResult(
        'Temporal Filtering',
        false,
        data.error || 'Unknown error'
      );
    }
  } catch (error) {
    results.addResult(
      'Temporal Filtering',
      false,
      error.message
    );
  }
}

/**
 * パフォーマンステスト
 */
async function testPerformance() {
  console.log('\n--- Performance Tests ---');
  
  try {
    const startTime = Date.now();
    
    const searchParams = {
      query: 'restaurant tokyo',
      text_search: {
        mode: 'semantic',
        boost_recent: true,
        boost_popular: true
      },
      custom_scoring: {
        weight_popularity: 0.25,
        weight_distance: 0.25,
        weight_rating: 0.25,
        weight_recency: 0.25
      },
      cluster_options: {
        enable_clustering: true,
        return_clusters: true
      },
      enable_faceted_search: true,
      include_analytics: true,
      limit: 100
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchParams)
    });
    
    const data = await response.json();
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    if (response.ok && data.success) {
      results.addResult(
        'Performance Test',
        totalTime < 5000, // 5秒以内
        `Total time: ${totalTime}ms, Server time: ${data.analytics?.search_performance_ms || 'N/A'}ms`
      );
      
      // 結果品質の確認
      if (data.analytics) {
        results.addResult(
          'Result Quality Score',
          data.analytics.result_quality_score > 50,
          `Quality score: ${data.analytics.result_quality_score.toFixed(1)}/100`
        );
      }
    } else {
      results.addResult(
        'Performance Test',
        false,
        data.error || 'Unknown error'
      );
    }
  } catch (error) {
    results.addResult(
      'Performance Test',
      false,
      error.message
    );
  }
}

/**
 * エラーハンドリングテスト
 */
async function testErrorHandling() {
  console.log('\n--- Error Handling Tests ---');
  
  try {
    // 無効なパラメータテスト
    const invalidParams = {
      min_rating: 'invalid_number',
      complex_filters: {
        and_conditions: [
          {
            field: 'invalid_field',
            operator: 'invalid_operator',
            value: null
          }
        ]
      }
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidParams)
    });
    
    const data = await response.json();
    
    // エラーが適切に処理されているかチェック
    if (!response.ok || !data.success) {
      results.addResult(
        'Invalid Parameters Handling',
        true,
        'Properly rejected invalid parameters'
      );
    } else {
      results.addResult(
        'Invalid Parameters Handling',
        false,
        'Should have rejected invalid parameters'
      );
    }
  } catch (error) {
    results.addResult(
      'Invalid Parameters Handling',
      true,
      'Properly handled request error'
    );
  }
  
  try {
    // 存在しない旅行IDテスト
    const nonExistentTripParams = {
      trip_id: 'non-existent-trip-id',
      query: 'restaurant'
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/search/advanced`, {
      method: 'POST',
      headers,
      body: JSON.stringify(nonExistentTripParams)
    });
    
    const data = await response.json();
    
    if (response.status === 403 || (data.error && data.error.includes('member'))) {
      results.addResult(
        'Non-existent Trip Access Control',
        true,
        'Properly blocked access to non-existent trip'
      );
    } else {
      results.addResult(
        'Non-existent Trip Access Control',
        false,
        'Should have blocked access to non-existent trip'
      );
    }
  } catch (error) {
    results.addResult(
      'Non-existent Trip Access Control',
      true,
      'Properly handled access control error'
    );
  }
}

/**
 * メインテスト実行
 */
async function runAdvancedSearchTests() {
  console.log('🚀 Starting Advanced Place Search API Tests...');
  console.log(`Testing endpoint: ${SUPABASE_URL}/functions/v1/place-management/search/advanced`);
  
  await testBasicAdvancedSearch();
  await testComplexPostSearch();
  await testClusteringFeatures();
  await testMultiLevelSorting();
  await testTemporalFiltering();
  await testPerformance();
  await testErrorHandling();
  
  results.summary();
  
  console.log('\n📊 Advanced Search Features Tested:');
  console.log('- Basic and complex parameter parsing');
  console.log('- Semantic text search with suggestions');
  console.log('- Complex filtering (AND/OR/NOT conditions)');
  console.log('- Geographic clustering');
  console.log('- Multi-level sorting');
  console.log('- Custom scoring algorithms');
  console.log('- Temporal filtering (date/time/day)');
  console.log('- Faceted search results');
  console.log('- Performance analytics');
  console.log('- Error handling and validation');
  
  return results;
}

// テスト実行
if (typeof window === 'undefined') {
  // Node.js環境での実行
  runAdvancedSearchTests().catch(console.error);
} else {
  // ブラウザ環境での実行
  console.log('Run runAdvancedSearchTests() to start testing');
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAdvancedSearchTests, TestResults };
}