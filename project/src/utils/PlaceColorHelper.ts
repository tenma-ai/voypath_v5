// 場所の色表示ロジック共通ヘルパー

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
}

/**
 * 場所の貢献者に基づいて色表示を計算する
 * @param place 場所オブジェクト
 * @param members トリップメンバー一覧
 * @returns 色表示設定
 */
export function calculatePlaceColor(place: any, members: any[] = []): PlaceColorResult {
  // システム場所（出発地・到着地・空港）の場合は特別な処理
  if (place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport') {
    return {
      type: 'single',
      background: '#374151', // Gray-700 for system places
      contributors: []
    };
  }

  // 貢献者の取得
  const contributors = getPlaceContributors(place, members);
  
  if (contributors.length === 0) {
    // 貢献者がいない場合はデフォルト色
    return {
      type: 'single',
      background: '#6B7280', // Gray-500
      contributors: []
    };
  }

  if (contributors.length === 1) {
    // 1人の貢献者: 単色表示
    return {
      type: 'single',
      background: contributors[0].color,
      contributors
    };
  }

  if (contributors.length >= 2 && contributors.length <= 4) {
    // 2-4人の貢献者: グラデーション表示
    const gradientColors = contributors.slice(0, 3).map(c => c.color);
    
    let background: string;
    if (gradientColors.length === 2) {
      background = `linear-gradient(45deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`;
    } else {
      background = `linear-gradient(45deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 50%, ${gradientColors[2]} 100%)`;
    }

    return {
      type: 'gradient',
      background,
      contributors
    };
  }

  // 5人以上の貢献者: 金色表示
  return {
    type: 'gold',
    background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
    contributors
  };
}

/**
 * 場所の貢献者を取得する
 * @param place 場所オブジェクト
 * @param members トリップメンバー一覧
 * @returns 貢献者一覧
 */
function getPlaceContributors(place: any, members: any[]): MemberContribution[] {
  const contributors: MemberContribution[] = [];

  // 場所を追加したユーザー
  if (place.userId || place.user_id) {
    const member = members.find(m => m.id === (place.userId || place.user_id));
    if (member) {
      contributors.push({
        userId: member.id,
        memberName: member.name,
        color: member.color || getDefaultMemberColor(member.id)
      });
    }
  }

  // 他の貢献者（いいね、コメント、編集など）の情報があれば追加
  // 現在は基本実装のみ

  return contributors;
}

/**
 * デフォルトメンバー色を取得
 * @param userId ユーザーID
 * @returns CSS色文字列
 */
function getDefaultMemberColor(userId: string): string {
  const colors = [
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];

  // ユーザーIDに基づいて一貫した色を選択
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
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