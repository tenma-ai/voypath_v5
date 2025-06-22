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
 * @param members トリップメンバー一覧（color情報を含む）
 * @param memberColors MemberColorServiceからの色マッピング（オプション）
 * @returns 色表示設定
 */
export function calculatePlaceColor(place: any, members: any[] = [], memberColors?: Record<string, string>): PlaceColorResult {
  // システム場所（出発地・到着地・空港）の場合は特別な処理
  if (place.place_type === 'departure' || place.place_type === 'destination' || place.place_type === 'airport') {
    return {
      type: 'single',
      background: '#374151', // Gray-700 for system places
      contributors: []
    };
  }

  // 貢献者の取得
  const contributors = getPlaceContributors(place, members, memberColors);
  
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
 * @param memberColors MemberColorServiceからの色マッピング（オプション）
 * @returns 貢献者一覧
 */
function getPlaceContributors(place: any, members: any[], memberColors?: Record<string, string>): MemberContribution[] {
  const contributors: MemberContribution[] = [];

  // 場所を追加したユーザー
  if (place.userId || place.user_id) {
    const userId = place.userId || place.user_id;
    const member = members.find(m => m.id === userId);
    
    // 色の優先順位: memberColors > member.color > デフォルト色
    let color: string;
    if (memberColors && memberColors[userId]) {
      color = memberColors[userId];
    } else if (member?.color) {
      color = member.color;
    } else {
      color = getDefaultMemberColor(userId);
    }
    
    if (member) {
      contributors.push({
        userId: member.id,
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
  // MemberColorServiceから色を取得するための参照色リスト
  const colors = [
    '#0077BE', // Ocean Blue
    '#228B22', // Forest Green
    '#FF6B35', // Sunset Orange
    '#7B68EE', // Royal Purple
    '#DC143C', // Cherry Red
    '#008080', // Teal
    '#FFC000', // Amber
    '#E6E6FA', // Lavender
    '#FF7F50', // Coral
    '#50C878', // Emerald
    '#FF00FF', // Magenta
    '#000080', // Navy
    '#FF007F', // Rose
    '#32CD32', // Lime
    '#4B0082', // Indigo
    '#40E0D0', // Turquoise
    '#B22222', // Crimson
    '#808000', // Olive
    '#708090', // Slate
    '#800000', // Maroon
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