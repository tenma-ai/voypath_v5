"use server";

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

interface UnifiedPlaceData {
  trip_id: string;
  name: string;
  address: string;
  google_place_id: string;
  latitude: number;
  longitude: number;
  user_id: string | null;
  session_id: string | null;
  wish_level: number;
  stay_duration_minutes: number;
  preferred_date?: string | null;
  notes?: string | null;
  is_personal_favorite?: boolean;
}

interface PlaceContributor {
  user_id: string | null;
  session_id: string | null;
  display_name: string;
  wish_level: number;
  stay_duration_minutes: number;
  added_at: string;
}

/**
 * 統一的な場所追加ロジック
 * 複数ユーザーが同じ場所を追加した場合、最長滞在時間を採用し、
 * 各ユーザーの貢献をmember_contributionに記録
 */
export async function addUnifiedPlace(placeData: UnifiedPlaceData) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // 既存の場所を検索（同じtrip_idとgoogle_place_id）
    const { data: existingPlace } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', placeData.trip_id)
      .eq('google_place_id', placeData.google_place_id)
      .single();
    
    // ユーザー/セッション情報を取得
    const contributor: PlaceContributor = {
      user_id: placeData.user_id,
      session_id: placeData.session_id,
      display_name: placeData.user_id ? 'User' : `Guest-${placeData.session_id?.slice(-6)}`,
      wish_level: placeData.wish_level,
      stay_duration_minutes: placeData.stay_duration_minutes,
      added_at: new Date().toISOString()
    };
    
    if (existingPlace) {
      // 既存の場所が見つかった場合、更新処理
      const currentContributors = existingPlace.member_contribution?.contributors || [];
      
      // 既存の貢献者をチェック
      const existingContributorIndex = currentContributors.findIndex((c: PlaceContributor) => 
        (c.user_id && c.user_id === contributor.user_id) ||
        (!c.user_id && c.session_id === contributor.session_id)
      );
      
      if (existingContributorIndex >= 0) {
        // 既存の貢献者の情報を更新
        currentContributors[existingContributorIndex] = contributor;
      } else {
        // 新しい貢献者として追加
        currentContributors.push(contributor);
      }
      
      // 最長滞在時間を計算
      const maxStayDuration = Math.max(
        existingPlace.stay_duration_minutes,
        placeData.stay_duration_minutes,
        ...currentContributors.map((c: PlaceContributor) => c.stay_duration_minutes)
      );
      
      // 平均wish_levelを計算
      const totalWishLevel = currentContributors.reduce((sum: number, c: PlaceContributor) => sum + c.wish_level, 0);
      const avgWishLevel = totalWishLevel / currentContributors.length;
      
      // メンバーカラーを取得
      const memberColors = await getMemberColors(placeData.trip_id);
      const displayColors = getContributorColors(currentContributors, memberColors);
      
      // 場所を更新
      const { data: updatedPlace, error } = await supabase
        .from('places')
        .update({
          stay_duration_minutes: maxStayDuration,
          user_avg_wish_level: avgWishLevel,
          member_contribution: {
            contributors: currentContributors,
            max_duration_contributor: currentContributors.find((c: PlaceContributor) => 
              c.stay_duration_minutes === maxStayDuration
            ),
            total_contributors: currentContributors.length
          },
          member_contributors: currentContributors.map((c: PlaceContributor) => c.user_id || c.session_id),
          display_color_hex: displayColors.primaryColor,
          color_type: displayColors.colorType,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlace.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating place:', error);
        throw new Error('Failed to update place');
      }
      
      return { 
        success: true, 
        placeId: updatedPlace.id, 
        isNew: false,
        message: 'Place updated with your preferences'
      };
      
    } else {
      // 新しい場所として追加
      const memberColors = await getMemberColors(placeData.trip_id);
      const userColor = getUserColor(contributor.user_id, contributor.session_id, memberColors);
      
      const { data: newPlace, error } = await supabase
        .from('places')
        .insert({
          trip_id: placeData.trip_id,
          name: placeData.name,
          address: placeData.address,
          google_place_id: placeData.google_place_id,
          latitude: placeData.latitude,
          longitude: placeData.longitude,
          wish_level: placeData.wish_level,
          stay_duration_minutes: placeData.stay_duration_minutes,
          user_id: placeData.user_id,
          user_avg_wish_level: placeData.wish_level,
          member_contribution: {
            contributors: [contributor],
            max_duration_contributor: contributor,
            total_contributors: 1
          },
          member_contributors: [contributor.user_id || contributor.session_id],
          display_color_hex: userColor,
          color_type: 'single',
          scheduled: false, // 新規追加時は未スケジュール（pending）状態
          scheduled_date: null, // 日付も未設定
          scheduled_time_start: null,
          scheduled_time_end: null,
          notes: placeData.notes,
          visit_date: placeData.preferred_date,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error adding new place:', error);
        throw new Error('Failed to add place');
      }
      
      return { 
        success: true, 
        placeId: newPlace.id, 
        isNew: true,
        message: 'Place added successfully'
      };
    }
  } catch (error) {
    console.error('Error in addUnifiedPlace:', error);
    throw error;
  }
}

/**
 * メンバーカラーを取得
 */
async function getMemberColors(tripId: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  const { data: memberColors } = await supabase
    .from('member_colors')
    .select('*')
    .eq('trip_id', tripId)
    .order('color_index');
  
  return memberColors || [];
}

/**
 * 特定のユーザー/セッションのカラーを取得
 */
function getUserColor(userId: string | null, sessionId: string | null, memberColors: any[]) {
  const userColor = memberColors.find(mc => 
    (userId && mc.user_id === userId) || 
    (!userId && mc.session_id === sessionId)
  );
  
  return userColor?.assigned_color || '#6B7280'; // デフォルトはグレー
}

/**
 * 複数の貢献者のカラーを計算（グラデーション対応）
 */
function getContributorColors(contributors: PlaceContributor[], memberColors: any[]) {
  if (contributors.length === 1) {
    const color = getUserColor(
      contributors[0].user_id,
      contributors[0].session_id,
      memberColors
    );
    return { primaryColor: color, colorType: 'single' };
  }
  
  // 複数の貢献者がいる場合、最も高いwish_levelを持つ人の色を使用
  const topContributor = contributors.reduce((prev, current) => 
    current.wish_level > prev.wish_level ? current : prev
  );
  
  const primaryColor = getUserColor(
    topContributor.user_id,
    topContributor.session_id,
    memberColors
  );
  
  return { primaryColor, colorType: 'gradient' };
}

/**
 * トリップ内の全場所を取得（My Places / Trip Places区別付き）
 */
export async function getUnifiedPlaces(tripId: string, userId: string | null, sessionId: string | null) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // 全ての場所を取得
    const { data: places, error } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching places:', error);
      throw new Error('Failed to fetch places');
    }
    
    // 各場所を分類
    const categorizedPlaces = places.map(place => {
      const contributors = place.member_contribution?.contributors || [];
      const isMyPlace = contributors.some((c: PlaceContributor) => 
        (userId && c.user_id === userId) || 
        (!userId && c.session_id === sessionId)
      );
      
      return {
        ...place,
        isMyPlace,
        contributorCount: contributors.length,
        status: place.scheduled ? 'scheduled' : 
                place.scheduled_date ? 'pending' : 
                'unscheduled'
      };
    });
    
    return {
      success: true,
      places: categorizedPlaces,
      myPlaces: categorizedPlaces.filter(p => p.isMyPlace),
      tripPlaces: categorizedPlaces
    };
  } catch (error) {
    console.error('Error in getUnifiedPlaces:', error);
    throw error;
  }
}

/**
 * メンバーカラーの初期化・同期
 */
export async function syncMemberColors(tripId: string) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  try {
    // トリップメンバーを取得
    const { data: members } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', tripId)
      .order('joined_at');
    
    if (!members) return;
    
    // 定義済みカラーパレット（見やすい色を選定）
    const colorPalette = [
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
    ];
    
    // 既存のカラー割り当てを確認
    const { data: existingColors } = await supabase
      .from('member_colors')
      .select('*')
      .eq('trip_id', tripId);
    
    const existingColorMap = new Map(
      existingColors?.map(ec => [ec.user_id || ec.session_id, ec])
    );
    
    // 各メンバーにカラーを割り当て
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberKey = member.user_id || member.session_id;
      
      if (!existingColorMap.has(memberKey)) {
        // 新しいメンバーにカラーを割り当て
        const colorIndex = i % colorPalette.length;
        const color = colorPalette[colorIndex];
        
        await supabase
          .from('member_colors')
          .insert({
            trip_id: tripId,
            user_id: member.user_id,
            session_id: member.session_id,
            display_name: member.display_name,
            assigned_color: color,
            color_index: i
          });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error syncing member colors:', error);
    throw error;
  }
}