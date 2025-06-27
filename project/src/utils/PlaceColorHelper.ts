// 場所の色表示ロジック共通ヘルパー
import { getColorOrFallback, debugColorIssue } from './ColorFallbackUtils';
import { MemberColorService } from '../services/MemberColorService';

export interface MemberContribution {
  userId: string;
  memberName: string;
  color: string;
}

export interface PlaceColorResult {
  type: 'single' | 'gradient' | 'gold';
  background: string;
  boxShadow?: string;
  contributors: MemberContribution[];
  className?: string; // CSS class name for styling
  userId?: string; // For backward compatibility with single contributor
}

/**
 * 場所の貢献者に基づいて色表示を計算する
 * @param place 場所オブジェクト
 * @param members トリップメンバー一覧（color情報を含む）
 * @param memberColors MemberColorServiceからの色マッピング（オプション）
 * @returns 色表示設定
 */
export function calculatePlaceColor(place: any, members: any[] = [], memberColors?: Record<string, string>): PlaceColorResult {
  console.log('🎨 [PlaceColorHelper] Calculating color for place:', {
    placeName: place.name,
    placeType: place.place_type,
    userId: place.userId || place.user_id,
    membersCount: members.length,
    memberColors: memberColors
  });

  // システム場所（出発地・到着地・空港）の場合は特別な処理
  if (place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport') {
    console.log('🎨 [PlaceColorHelper] System place, using gray color');
    return {
      type: 'single',
      background: '#374151', // Gray-700 for system places
      contributors: []
    };
  }

  // 貢献者の取得
  const contributors = getPlaceContributors(place, members, memberColors);
  console.log('🎨 [PlaceColorHelper] Contributors found:', contributors);
  
  if (contributors.length === 0) {
    // 貢献者がいない場合はデフォルト色
    console.log('🎨 [PlaceColorHelper] No contributors, using default gray');
    return {
      type: 'single',
      background: '#6B7280', // Gray-500
      contributors: []
    };
  }

  if (contributors.length === 1) {
    // 1人の貢献者: 単色表示
    console.log('🎨 [PlaceColorHelper] Single contributor, color:', contributors[0].color);
    return {
      type: 'single',
      background: contributors[0].color,
      className: 'place-single',
      contributors,
      userId: contributors[0].userId // For backward compatibility
    };
  }

  if (contributors.length >= 2 && contributors.length <= 4) {
    // 2-4人の貢献者: グラデーション表示
    const gradientColors = contributors.slice(0, 3).map(c => c.color);
    
    let background: string;
    let className: string;
    if (gradientColors.length === 2) {
      background = `linear-gradient(45deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`;
      className = 'place-gradient-two';
    } else {
      background = `linear-gradient(45deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 50%, ${gradientColors[2]} 100%)`;
      className = 'place-gradient';
    }

    return {
      type: 'gradient',
      background,
      className,
      contributors
    };
  }

  // 5人以上の貢献者: 金色表示
  return {
    type: 'gold',
    background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
    className: 'place-gold',
    contributors
  };
}

/**
 * 場所の貢献者を取得する
 * @param place 場所オブジェクト
 * @param members トリップメンバー一覧
 * @param memberColors MemberColorServiceからの色マッピング（オプション）
 * @returns 貢献者一覧
 */
function getPlaceContributors(place: any, members: any[], memberColors?: Record<string, string>): MemberContribution[] {
  const contributors: MemberContribution[] = [];

  // 場所を追加したユーザー
  if (place.userId || place.user_id) {
    const userId = place.userId || place.user_id;
    const member = members.find(m => m.id === userId || m.user_id === userId);
    
    // 色の優先順位: memberColors > member.color > デフォルト色
    let color: string;
    if (memberColors && memberColors[userId]) {
      color = getColorOrFallback(memberColors[userId], 0);
    } else if (member?.color) {
      color = getColorOrFallback(member.color, 0);
    } else {
      color = getDefaultMemberColor(userId);
    }
    
    // Debug color issue if needed
    if (process.env.NODE_ENV === 'development') {
      debugColorIssue('PlaceColorHelper.getPlaceContributors', place, memberColors || {}, color);
    }
    
    if (member) {
      contributors.push({
        userId: member.id || member.user_id,
        memberName: member.name,
        color: color
      });
    }
  }

  // 他の貢献者（いいね、コメント、編集など）の情報があれば追加
  // 現在は基本実装のみ

  return contributors;
}

/**
 * デフォルトメンバー色を取得（MemberColorServiceと一致）
 * @param userId ユーザーID
 * @returns CSS色文字列
 */
function getDefaultMemberColor(userId: string): string {
  // ユーザーIDに基づいて一貫した色を選択
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return MemberColorService.getColorByIndex(hash % 20).hex;
}

/**
 * CSS custom properties として色を適用するためのヘルパー
 * @param colorResult calculatePlaceColor の結果
 * @returns CSS style オブジェクト
 */
export function getCSSProperties(colorResult: PlaceColorResult): React.CSSProperties {
  const style: React.CSSProperties = {
    background: colorResult.background,
  };

  if (colorResult.boxShadow) {
    style.boxShadow = colorResult.boxShadow;
  }

  // CSS custom properties として色を設定
  colorResult.contributors.forEach((contributor, index) => {
    (style as any)[`--member-color-${index}`] = contributor.color;
  });

  return style;
}