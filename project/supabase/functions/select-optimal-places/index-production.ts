import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Place {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  preference_score: number;
  normalized_preference?: number;
  type?: string;
  member_id: string;
  member_color?: string;
  stay_duration?: number;
}

interface Member {
  id: string;
  name: string;
  color: string;
  preference_weight: number;
}

interface SelectOptimalRequest {
  trip_id: string;
  normalized_places: Place[];
  members: Member[];
  trip_duration_days: number;
  max_places_per_day: number;
  fairness_threshold: number;
}

interface OptimalSelectionResult {
  selected_places: Place[];
  fairness_score: number;
  efficiency_score: number;
  selection_rationale: string;
  member_distribution: Record<string, number>;
}

// スケジューリング制約の計算
function calculateTimeConstraints(tripDurationDays: number, maxPlacesPerDay: number): {
  maxTotalPlaces: number;
  timePerPlace: number;
  travelBuffer: number;
} {
  const maxTotalPlaces = tripDurationDays * maxPlacesPerDay;
  const hoursPerDay = 12; // 旅行可能時間（朝8時〜夜8時）
  const timePerPlace = (hoursPerDay / maxPlacesPerDay) * 60; // 分単位
  const travelBuffer = timePerPlace * 0.3; // 移動時間バッファ
  
  return {
    maxTotalPlaces,
    timePerPlace,
    travelBuffer
  };
}

// 地理的クラスタリングによる場所の効率性評価
function calculateGeographicEfficiency(places: Place[]): number {
  if (places.length <= 1) return 1.0;
  
  let totalDistance = 0;
  let minDistance = Infinity;
  let maxDistance = 0;
  
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const distance = haversineDistance(
        places[i].location.lat,
        places[i].location.lng,
        places[j].location.lat,
        places[j].location.lng
      );
      totalDistance += distance;
      minDistance = Math.min(minDistance, distance);
      maxDistance = Math.max(maxDistance, distance);
    }
  }
  
  const avgDistance = totalDistance / (places.length * (places.length - 1) / 2);
  const efficiency = Math.max(0, 1 - (avgDistance / 1000)); // 1000km基準で正規化
  
  return Math.min(1.0, efficiency);
}

// ハーバーサイン距離計算
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球の半径 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// メンバー間の公平性評価
function calculateMemberFairness(places: Place[], members: Member[]): {
  fairnessScore: number;
  memberDistribution: Record<string, number>;
} {
  const memberCounts: Record<string, number> = {};
  const memberScores: Record<string, number> = {};
  
  // 各メンバーの場所数とスコア合計を計算
  members.forEach(member => {
    memberCounts[member.id] = 0;
    memberScores[member.id] = 0;
  });
  
  places.forEach(place => {
    if (memberCounts[place.member_id] !== undefined) {
      memberCounts[place.member_id]++;
      memberScores[place.member_id] += place.normalized_preference || 0;
    }
  });
  
  // 標準偏差を使用した公平性スコア計算
  const counts = Object.values(memberCounts);
  const scores = Object.values(memberScores);
  
  const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  const countVariance = counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length;
  const scoreVariance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
  
  const countStdDev = Math.sqrt(countVariance);
  const scoreStdDev = Math.sqrt(scoreVariance);
  
  // 公平性スコア: 標準偏差が小さいほど高スコア
  const countFairness = Math.max(0, 1 - (countStdDev / Math.max(avgCount, 1)));
  const scoreFairness = Math.max(0, 1 - (scoreStdDev / Math.max(avgScore, 1)));
  
  const fairnessScore = (countFairness + scoreFairness) / 2;
  
  return {
    fairnessScore,
    memberDistribution: memberCounts
  };
}

// 遺伝的アルゴリズムによる最適選択
function geneticAlgorithmSelection(
  places: Place[],
  members: Member[],
  constraints: { maxTotalPlaces: number; timePerPlace: number; travelBuffer: number },
  fairnessThreshold: number
): Place[] {
  const populationSize = Math.min(100, Math.max(20, places.length));
  const generations = 50;
  const mutationRate = 0.1;
  const eliteSize = Math.floor(populationSize * 0.2);
  
  // 初期集団生成
  let population: Place[][] = [];
  for (let i = 0; i < populationSize; i++) {
    const individual = generateRandomSelection(places, constraints.maxTotalPlaces, members);
    population.push(individual);
  }
  
  // 進化過程
  for (let gen = 0; gen < generations; gen++) {
    // 評価
    const evaluated = population.map(individual => ({
      individual,
      fitness: evaluateFitness(individual, members, fairnessThreshold, constraints)
    }));
    
    // ソート（適応度順）
    evaluated.sort((a, b) => b.fitness - a.fitness);
    
    // エリート選択
    const newPopulation: Place[][] = evaluated.slice(0, eliteSize).map(e => e.individual);
    
    // 交叉と突然変異
    while (newPopulation.length < populationSize) {
      const parent1 = tournamentSelection(evaluated);
      const parent2 = tournamentSelection(evaluated);
      const child = crossover(parent1, parent2, constraints.maxTotalPlaces);
      
      if (Math.random() < mutationRate) {
        mutate(child, places, constraints.maxTotalPlaces);
      }
      
      newPopulation.push(child);
    }
    
    population = newPopulation;
  }
  
  // 最終評価と最良個体の選択
  const finalEvaluated = population.map(individual => ({
    individual,
    fitness: evaluateFitness(individual, members, fairnessThreshold, constraints)
  }));
  
  finalEvaluated.sort((a, b) => b.fitness - a.fitness);
  return finalEvaluated[0].individual;
}

// ランダム選択生成
function generateRandomSelection(places: Place[], maxPlaces: number, members: Member[]): Place[] {
  const targetSize = Math.min(maxPlaces, Math.floor(places.length * 0.7));
  const shuffled = [...places].sort(() => Math.random() - 0.5);
  
  // メンバーごとに最低1つの場所を保証
  const selected: Place[] = [];
  const memberPlaces: Record<string, Place[]> = {};
  
  members.forEach(member => {
    memberPlaces[member.id] = places.filter(p => p.member_id === member.id);
  });
  
  // 各メンバーから1つずつ選択
  members.forEach(member => {
    if (memberPlaces[member.id].length > 0 && selected.length < targetSize) {
      const randomPlace = memberPlaces[member.id][Math.floor(Math.random() * memberPlaces[member.id].length)];
      if (!selected.find(p => p.id === randomPlace.id)) {
        selected.push(randomPlace);
      }
    }
  });
  
  // 残りをランダムに追加
  while (selected.length < targetSize) {
    const randomPlace = shuffled[Math.floor(Math.random() * shuffled.length)];
    if (!selected.find(p => p.id === randomPlace.id)) {
      selected.push(randomPlace);
    }
  }
  
  return selected;
}

// 適応度評価
function evaluateFitness(
  selection: Place[],
  members: Member[],
  fairnessThreshold: number,
  constraints: { maxTotalPlaces: number; timePerPlace: number; travelBuffer: number }
): number {
  // サイズ制約チェック
  if (selection.length > constraints.maxTotalPlaces) {
    return 0;
  }
  
  // 公平性評価
  const { fairnessScore } = calculateMemberFairness(selection, members);
  if (fairnessScore < fairnessThreshold) {
    return 0;
  }
  
  // 効率性評価
  const efficiencyScore = calculateGeographicEfficiency(selection);
  
  // 嗜好スコア評価
  const totalPreference = selection.reduce((sum, place) => sum + (place.normalized_preference || 0), 0);
  const avgPreference = totalPreference / selection.length;
  
  // 多様性評価
  const diversityScore = calculateTypeDiversity(selection);
  
  // 総合適応度
  const fitness = (
    fairnessScore * 0.3 +
    efficiencyScore * 0.25 +
    avgPreference * 0.25 +
    diversityScore * 0.2
  );
  
  return fitness;
}

// 種類の多様性評価
function calculateTypeDiversity(places: Place[]): number {
  const types = new Set(places.map(p => p.type || 'unknown'));
  const maxTypes = 10; // 想定される最大種類数
  return Math.min(1.0, types.size / maxTypes);
}

// トーナメント選択
function tournamentSelection(evaluated: { individual: Place[]; fitness: number }[]): Place[] {
  const tournamentSize = 3;
  const tournament = [];
  
  for (let i = 0; i < tournamentSize; i++) {
    const randomIndex = Math.floor(Math.random() * evaluated.length);
    tournament.push(evaluated[randomIndex]);
  }
  
  tournament.sort((a, b) => b.fitness - a.fitness);
  return tournament[0].individual;
}

// 交叉
function crossover(parent1: Place[], parent2: Place[], maxSize: number): Place[] {
  const crossoverPoint = Math.floor(Math.random() * Math.min(parent1.length, parent2.length));
  const child = [...parent1.slice(0, crossoverPoint)];
  
  // 重複を避けながら parent2 から追加
  for (const place of parent2) {
    if (!child.find(p => p.id === place.id) && child.length < maxSize) {
      child.push(place);
    }
  }
  
  return child;
}

// 突然変異
function mutate(individual: Place[], allPlaces: Place[], maxSize: number): void {
  if (individual.length === 0) return;
  
  if (Math.random() < 0.5 && individual.length > 1) {
    // 削除突然変異
    const removeIndex = Math.floor(Math.random() * individual.length);
    individual.splice(removeIndex, 1);
  } else if (individual.length < maxSize) {
    // 追加突然変異
    const availablePlaces = allPlaces.filter(p => !individual.find(ip => ip.id === p.id));
    if (availablePlaces.length > 0) {
      const addPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
      individual.push(addPlace);
    }
  }
}

// グリーディアプローチによる高速選択（フォールバック）
function greedySelection(
  places: Place[],
  members: Member[],
  maxPlaces: number,
  fairnessThreshold: number
): Place[] {
  const selected: Place[] = [];
  const memberCounts: Record<string, number> = {};
  
  members.forEach(member => {
    memberCounts[member.id] = 0;
  });
  
  // 正規化された嗜好度でソート
  const sortedPlaces = [...places].sort((a, b) => 
    (b.normalized_preference || 0) - (a.normalized_preference || 0)
  );
  
  for (const place of sortedPlaces) {
    if (selected.length >= maxPlaces) break;
    
    // 仮に追加した場合の公平性をチェック
    const tempSelected = [...selected, place];
    const { fairnessScore } = calculateMemberFairness(tempSelected, members);
    
    if (fairnessScore >= fairnessThreshold) {
      selected.push(place);
      memberCounts[place.member_id]++;
    }
  }
  
  return selected;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { trip_id, normalized_places, members, trip_duration_days, max_places_per_day, fairness_threshold }: SelectOptimalRequest = await req.json();

    console.log(`Starting optimal place selection for trip ${trip_id}`);
    console.log(`Input: ${normalized_places.length} places, ${members.length} members`);

    // Step 4: 時間制約計算
    const constraints = calculateTimeConstraints(trip_duration_days, max_places_per_day);
    console.log(`Time constraints: max ${constraints.maxTotalPlaces} places, ${constraints.timePerPlace} min per place`);

    // Step 4: 最適選択実行
    let selectedPlaces: Place[];
    
    try {
      // 遺伝的アルゴリズムによる最適化
      selectedPlaces = geneticAlgorithmSelection(
        normalized_places,
        members,
        constraints,
        fairness_threshold
      );
      console.log(`Genetic algorithm selected ${selectedPlaces.length} places`);
    } catch (error) {
      console.log(`Genetic algorithm failed, using greedy approach: ${error.message}`);
      // フォールバック: グリーディアプローチ
      selectedPlaces = greedySelection(
        normalized_places,
        members,
        constraints.maxTotalPlaces,
        fairness_threshold
      );
    }

    // 結果評価
    const { fairnessScore, memberDistribution } = calculateMemberFairness(selectedPlaces, members);
    const efficiencyScore = calculateGeographicEfficiency(selectedPlaces);
    
    // 選択理由の生成
    const selectionRationale = `Selected ${selectedPlaces.length}/${normalized_places.length} places using ${selectedPlaces.length > 20 ? 'genetic algorithm' : 'greedy approach'}. ` +
      `Fairness: ${(fairnessScore * 100).toFixed(1)}%, Efficiency: ${(efficiencyScore * 100).toFixed(1)}%. ` +
      `Member distribution: ${Object.entries(memberDistribution).map(([id, count]) => `${members.find(m => m.id === id)?.name || id}: ${count}`).join(', ')}.`;

    // データベースに結果を保存
    const { error: saveError } = await supabaseClient
      .from('trip_optimization_results')
      .upsert({
        trip_id,
        step: 'select_optimal_places',
        result: {
          selected_places: selectedPlaces,
          fairness_score: fairnessScore,
          efficiency_score: efficiencyScore,
          selection_rationale: selectionRationale,
          member_distribution: memberDistribution,
          constraints_used: constraints
        },
        created_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving optimal selection results:', saveError);
    }

    const result: OptimalSelectionResult = {
      selected_places: selectedPlaces,
      fairness_score: fairnessScore,
      efficiency_score: efficiencyScore,
      selection_rationale: selectionRationale,
      member_distribution: memberDistribution
    };

    console.log(`Optimal place selection completed successfully`);
    console.log(`Final selection: ${selectedPlaces.length} places, fairness: ${(fairnessScore * 100).toFixed(1)}%, efficiency: ${(efficiencyScore * 100).toFixed(1)}%`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in select-optimal-places:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        step: 'select_optimal_places',
        details: 'Failed to select optimal places combination'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});