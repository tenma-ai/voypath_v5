/**
 * 時間関連のユーティリティ関数
 */

/**
 * 分を人間が読みやすい形式にフォーマット
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    if (remainingMinutes === 0) {
      return `${hours}時間`;
    }
    return `${hours}時間${remainingMinutes}分`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (remainingHours === 0) {
    return `${days}日`;
  }
  
  return `${days}日${remainingHours}時間`;
}

/**
 * 時刻文字列を分に変換
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 分を時刻文字列に変換
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 日付と時刻を組み合わせてDateオブジェクトを作成
 */
export function combineDateAndTime(date: Date | string, time: string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const [hours, minutes] = time.split(':').map(Number);
  
  const combined = new Date(dateObj);
  combined.setHours(hours, minutes, 0, 0);
  
  return combined;
}

/**
 * 2つの時刻の差を分で返す
 */
export function getTimeDifferenceInMinutes(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // 日を跨ぐ場合の考慮
  if (endMinutes < startMinutes) {
    return (24 * 60 - startMinutes) + endMinutes;
  }
  
  return endMinutes - startMinutes;
}

/**
 * 営業時間の判定
 */
export function isWithinBusinessHours(
  currentTime: Date,
  openingHours?: { open: string; close: string }
): boolean {
  if (!openingHours) return true; // 営業時間が不明な場合は常に開いているとみなす
  
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const openMinutes = timeToMinutes(openingHours.open);
  const closeMinutes = timeToMinutes(openingHours.close);
  
  // 日を跨ぐ場合の考慮
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }
  
  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}