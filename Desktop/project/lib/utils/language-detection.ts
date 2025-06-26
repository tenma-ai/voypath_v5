/**
 * 言語検出のためのユーティリティ関数
 */

/**
 * ユーザーの言語を検出する
 * @returns 検出された言語コード（例: 'en', 'ja', 'fr'）
 */
export const detectUserLanguage = (): string => {
  if (typeof window === 'undefined') {
    return 'en'; // サーバーサイドではデフォルト英語
  }
  
  // 複数のソースから言語を検出
  const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  
  // 主要言語コードを抽出（例: 'en-US' -> 'en'）
  const primaryLang = browserLang.split('-')[0];
  
  // Google Maps APIがサポートする言語リスト
  const supportedLanguages = [
    'af', 'am', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'cs', 'da', 'de',
    'el', 'en', 'es', 'et', 'eu', 'fa', 'fi', 'fil', 'fr', 'gl', 'gu', 'hi',
    'hr', 'hu', 'hy', 'id', 'is', 'it', 'iw', 'ja', 'ka', 'kk', 'km', 'kn',
    'ko', 'ky', 'lo', 'lt', 'lv', 'mk', 'ml', 'mn', 'mr', 'ms', 'my', 'nb',
    'ne', 'nl', 'no', 'pa', 'pl', 'pt', 'ro', 'ru', 'si', 'sk', 'sl', 'sq',
    'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'zh'
  ];
  
  console.log('🌍 検出された言語:', primaryLang);
  
  // サポートされている言語か英語にフォールバック
  return supportedLanguages.includes(primaryLang) ? primaryLang : 'en';
};

/**
 * ユーザーのリージョンを検出する
 * @returns 検出されたリージョンコード（例: 'US', 'JP', 'FR'）
 */
export const detectUserRegion = (): string => {
  if (typeof window === 'undefined') {
    return 'US'; // サーバーサイドではデフォルトUS
  }
  
  // ブラウザの言語からリージョンを取得
  const browserLang = navigator.language || 'en-US';
  const parts = browserLang.split('-');
  const region = parts.length > 1 ? parts[1] : undefined;
  
  console.log('🌍 検出されたリージョン:', region || 'US');
  
  // リージョンコードまたはデフォルトUSを返す
  return region || 'US';
};

/**
 * 検索ロケーションバイアスを取得する
 * @returns LocationBiasオブジェクト
 */
export const getLocationBias = () => {
  if (typeof window === 'undefined' || typeof google === 'undefined') {
    return undefined;
  }
  
  // ユーザーの位置情報を使用してバイアスを設定
  const worldBounds = {
    east: 180,
    north: 85,
    south: -85,
    west: -180
  };
  
  return worldBounds;
}; 