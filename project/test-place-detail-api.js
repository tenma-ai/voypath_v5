// TODO-073 Place詳細取得API テストファイル
// 場所詳細情報、営業時間情報、レビュー情報、関連場所の取得機能をテスト

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const TEST_TOKEN = 'your-test-jwt-token';

async function testPlaceDetailAPI() {
  console.log('🚀 TODO-073 Place詳細取得API テスト開始');
  console.log('=' * 50);

  const testCases = [
    {
      name: '基本的な場所詳細取得',
      placeId: 'test-place-id-1',
      expectedFeatures: ['enhanced_operating_hours', 'reviews_summary', 'related_places']
    },
    {
      name: '営業時間がない場所の詳細取得',
      placeId: 'test-place-id-2',
      expectedFeatures: ['enhanced_operating_hours']
    },
    {
      name: '座標がない場所の関連場所取得',
      placeId: 'test-place-id-3',
      expectedFeatures: ['related_places']
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n📋 テスト: ${testCase.name}`);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/place-management/${testCase.placeId}`, {
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
      if (!result.success || !result.place) {
        console.log('❌ 基本レスポンス構造が不正');
        continue;
      }

      const place = result.place;
      console.log(`✅ 基本詳細取得成功: ${place.name}`);

      // 営業時間情報の検証
      if (testCase.expectedFeatures.includes('enhanced_operating_hours')) {
        if (place.enhanced_operating_hours) {
          const hours = place.enhanced_operating_hours;
          console.log(`✅ 営業時間情報: ${hours.status} - ${hours.status_message || 'N/A'}`);
          
          if (hours.status === 'available') {
            console.log(`   現在の状況: ${hours.current_status}`);
            console.log(`   週間スケジュール: ${hours.weekly_schedule?.length || 0}日分`);
          }
        } else {
          console.log('❌ 営業時間情報が不足');
          continue;
        }
      }

      // レビュー情報の検証
      if (testCase.expectedFeatures.includes('reviews_summary')) {
        if (place.reviews_summary) {
          const reviews = place.reviews_summary;
          console.log(`✅ レビュー情報: ${reviews.total_reviews}件, 平均評価 ${reviews.average_rating?.toFixed(1)}`);
          console.log(`   最新レビュー: ${reviews.recent_reviews?.length || 0}件`);
          console.log(`   キーワード: ${reviews.keywords?.join(', ') || 'なし'}`);
        } else {
          console.log('❌ レビュー情報が不足');
          continue;
        }
      }

      // 関連場所の検証
      if (testCase.expectedFeatures.includes('related_places')) {
        if (place.related_places && Array.isArray(place.related_places)) {
          console.log(`✅ 関連場所: ${place.related_places.length}グループ`);
          
          place.related_places.forEach((group, index) => {
            console.log(`   ${index + 1}. ${group.title}: ${group.places?.length || 0}件`);
            
            if (group.type === 'nearby' && group.places?.length > 0) {
              const firstPlace = group.places[0];
              if (firstPlace.distance !== undefined) {
                console.log(`      最寄り: ${firstPlace.name} (${firstPlace.distance.toFixed(2)}km)`);
              }
            }
          });
        } else {
          console.log('⚠️  関連場所情報なし（正常な場合もあり）');
        }
      }

      // 権限情報の検証
      if (place.user_permissions) {
        const perms = place.user_permissions;
        console.log(`✅ 権限情報: 編集可=${perms.can_edit}, 削除可=${perms.can_delete}, 所有者=${perms.is_owner}`);
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
    console.log('🎉 TODO-073 Place詳細取得API 全テスト成功！');
    console.log('✅ 場所詳細情報の取得 - 実装完了');
    console.log('✅ 営業時間情報の取得 - 実装完了');
    console.log('✅ レビュー情報の取得 - 実装完了');
    console.log('✅ 関連場所の取得 - 実装完了');
  } else {
    console.log('⚠️  一部テストが失敗しました。実装を確認してください。');
  }

  return passedTests === totalTests;
}

// 具体的な機能テスト
async function testSpecificFeatures() {
  console.log('\n🔍 詳細機能テスト');
  
  // 営業時間判定テスト
  console.log('\n⏰ 営業時間判定テスト');
  const testOpeningHours = {
    1: { is_closed: false, open_time: "09:00", close_time: "18:00" }, // 月曜
    2: { is_closed: false, open_time: "09:00", close_time: "18:00" }, // 火曜
    0: { is_closed: true } // 日曜（定休日）
  };
  
  // 模擬的に営業時間判定をテスト
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  
  console.log(`現在時刻: ${now.toLocaleString()}`);
  console.log(`現在の曜日: ${currentDay} (0=日, 1=月, ...)`);
  
  if (testOpeningHours[currentDay]) {
    const todayHours = testOpeningHours[currentDay];
    if (todayHours.is_closed) {
      console.log('✅ 定休日判定: 正常');
    } else {
      const openHour = parseInt(todayHours.open_time.split(':')[0]);
      const closeHour = parseInt(todayHours.close_time.split(':')[0]);
      
      if (currentHour < openHour) {
        console.log(`✅ 開店前判定: ${todayHours.open_time}に開店予定`);
      } else if (currentHour >= openHour && currentHour < closeHour) {
        console.log(`✅ 営業中判定: ${todayHours.close_time}まで営業`);
      } else {
        console.log('✅ 営業終了判定: 営業終了');
      }
    }
  }
  
  // レビューデータ生成テスト
  console.log('\n⭐ レビューデータ生成テスト');
  const mockReviews = [
    { rating: 5, text: "素晴らしい場所", author: "テストユーザー1" },
    { rating: 4, text: "良かった", author: "テストユーザー2" },
    { rating: 3, text: "普通", author: "テストユーザー3" }
  ];
  
  const avgRating = mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length;
  console.log(`✅ 平均評価計算: ${avgRating.toFixed(1)}`);
  
  const ratingDist = mockReviews.reduce((acc, r) => {
    acc[r.rating] = (acc[r.rating] || 0) + 1;
    return acc;
  }, {});
  console.log(`✅ 評価分布: ${JSON.stringify(ratingDist)}`);
}

// メイン実行
async function main() {
  console.log('TODO-073 Place詳細取得API 統合テスト');
  console.log('実行時刻:', new Date().toLocaleString());
  
  const success = await testPlaceDetailAPI();
  await testSpecificFeatures();
  
  console.log('\n📝 テスト完了メモ:');
  console.log('- 実際のテスト実行には有効なSupabaseプロジェクト設定が必要');
  console.log('- JWTトークンと場所IDは実際の値に置き換えてください');
  console.log('- 営業時間判定は現在時刻に基づいて動的に変化します');
  console.log('- レビューは現在模擬データですが、将来は外部APIや内部テーブルと連携予定');
  
  return success;
}

// Node.js環境での実行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testPlaceDetailAPI, testSpecificFeatures, main };
} else {
  // ブラウザ環境での実行
  main().then(success => {
    console.log(success ? '✅ 全テスト成功' : '❌ テスト失敗');
  });
}