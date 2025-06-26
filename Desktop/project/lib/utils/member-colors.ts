// メンバーカラー管理ユーティリティ

export const MEMBER_COLOR_PALETTE = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#A855F7', // Purple
  '#F43F5E', // Rose
];

export interface MemberColor {
  userId?: string | null;
  sessionId?: string | null;
  displayName: string;
  color: string;
  colorIndex: number;
}

/**
 * メンバーのカラーインデックスを計算
 */
export function getMemberColorIndex(memberIndex: number): number {
  return memberIndex % MEMBER_COLOR_PALETTE.length;
}

/**
 * メンバーのカラーを取得
 */
export function getMemberColor(memberIndex: number): string {
  const colorIndex = getMemberColorIndex(memberIndex);
  return MEMBER_COLOR_PALETTE[colorIndex];
}

/**
 * カラーを少し暗くする（ホバー状態など用）
 */
export function darkenColor(color: string, amount: number = 20): string {
  // HEXをRGBに変換
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // 暗くする
  const newR = Math.max(0, r - amount);
  const newG = Math.max(0, g - amount);
  const newB = Math.max(0, b - amount);
  
  // RGBをHEXに戻す
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * カラーを透明にする（背景用）
 */
export function transparentizeColor(color: string, opacity: number = 0.1): string {
  // HEXをRGBに変換
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * グラデーションカラーを生成（複数メンバーの場合）
 */
export function generateGradient(colors: string[]): string {
  if (colors.length === 0) return '#6B7280';
  if (colors.length === 1) return colors[0];
  
  const gradientStops = colors.map((color, index) => {
    const percentage = (index / (colors.length - 1)) * 100;
    return `${color} ${percentage}%`;
  });
  
  return `linear-gradient(45deg, ${gradientStops.join(', ')})`;
}

/**
 * メンバーカラーのコンテキスト用フック
 */
export function useMemberColorContext(
  members: any[],
  currentUserId?: string | null,
  currentSessionId?: string | null
) {
  const memberColorMap = new Map<string, MemberColor>();
  
  members.forEach((member, index) => {
    const key = member.user_id || member.session_id;
    const color = getMemberColor(index);
    
    memberColorMap.set(key, {
      userId: member.user_id,
      sessionId: member.session_id,
      displayName: member.display_name,
      color,
      colorIndex: index
    });
  });
  
  const getCurrentUserColor = () => {
    const key = currentUserId || currentSessionId;
    if (!key) return null;
    return memberColorMap.get(key);
  };
  
  const getMemberColorByKey = (userId?: string | null, sessionId?: string | null) => {
    const key = userId || sessionId;
    if (!key) return null;
    return memberColorMap.get(key);
  };
  
  return {
    memberColorMap,
    getCurrentUserColor,
    getMemberColorByKey,
    colorPalette: MEMBER_COLOR_PALETTE
  };
}