# ルート最適化システム実装ガイド - Part 3: ステップ9-12

## ステップ9: 遺伝的アルゴリズムによる経路最適化

### 実装ファイル: `project/supabase/functions/optimize-route/index.ts`

```typescript
// optimize-route/index.ts:100-400
interface GeneticAlgorithmConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  eliteSize: number;
  crossoverRate: number;
}

class GeneticOptimizer {
  private config: GeneticAlgorithmConfig = {
    populationSize: 100,
    generations: 200,
    mutationRate: 0.02,
    eliteSize: 20,
    crossoverRate: 0.8
  };

  // 遺伝的アルゴリズムのメイン実行
  async optimize(
    places: Place[],
    constraints: OptimizationConstraints,
    progressCallback?: (progress: number) => void
  ): Promise<OptimizedRoute> {
    // 1. 初期集団の生成
    let population = this.createInitialPopulation(places, constraints);
    
    // 2. 世代進化のループ
    for (let generation = 0; generation < this.config.generations; generation++) {
      // 進捗通知
      if (progressCallback) {
        progressCallback(generation / this.config.generations);
      }
      
      // 3. 適応度評価
      const evaluatedPopulation = await this.evaluatePopulation(
        population, 
        constraints
      );
      
      // 4. 選択
      const selectedParents = this.selectParents(evaluatedPopulation);
      
      // 5. 交叉
      const offspring = this.crossover(selectedParents);
      
      // 6. 突然変異
      const mutatedOffspring = this.mutate(offspring, constraints);
      
      // 7. エリート保存と次世代生成
      population = this.createNextGeneration(
        evaluatedPopulation, 
        mutatedOffspring
      );
      
      // 8. 早期収束チェック
      if (this.hasConverged(population)) {
        console.log(`Converged at generation ${generation}`);
        break;
      }
    }
    
    // 最終的な最適解を返す
    const bestIndividual = this.getBestIndividual(population);
    return this.convertToOptimizedRoute(bestIndividual, constraints);
  }

  // 初期集団の生成（多様性を確保）
  private createInitialPopulation(
    places: Place[],
    constraints: OptimizationConstraints
  ): Individual[] {
    const population: Individual[] = [];
    const fixedStart = places.find(p => p.id === constraints.startPlaceId);
    const fixedEnd = places.find(p => p.id === constraints.endPlaceId);
    const variablePlaces = places.filter(
      p => p.id !== constraints.startPlaceId && p.id !== constraints.endPlaceId
    );
    
    for (let i = 0; i < this.config.populationSize; i++) {
      // ランダムな順序を生成
      const shuffled = [...variablePlaces].sort(() => Math.random() - 0.5);
      
      // 固定された出発地と目的地を追加
      const route = [
        fixedStart!,
        ...shuffled,
        fixedEnd!
      ];
      
      population.push({
        route,
        fitness: 0,
        totalDistance: 0,
        totalTime: 0
      });
    }
    
    return population;
  }

  // 適応度評価関数（複数の要素を考慮）
  private async evaluatePopulation(
    population: Individual[],
    constraints: OptimizationConstraints
  ): Promise<EvaluatedIndividual[]> {
    const evaluatedPopulation = await Promise.all(
      population.map(async individual => {
        const fitness = await this.calculateFitness(individual, constraints);
        return {
          ...individual,
          fitness,
          totalDistance: await this.calculateTotalDistance(individual.route),
          totalTime: await this.calculateTotalTime(individual.route)
        };
      })
    );
    
    return evaluatedPopulation;
  }

  // 適応度計算（多目的最適化）
  private async calculateFitness(
    individual: Individual,
    constraints: OptimizationConstraints
  ): Promise<number> {
    let fitness = 0;
    
    // 1. 距離スコア（短いほど良い）
    const distanceScore = 1 / (1 + individual.totalDistance / 1000);
    fitness += distanceScore * 0.3;
    
    // 2. 時間スコア（制約内で効率的）
    const timeScore = this.calculateTimeScore(
      individual.totalTime, 
      constraints.maxDuration
    );
    fitness += timeScore * 0.3;
    
    // 3. 選好度スコア（メンバーの希望を反映）
    const preferenceScore = this.calculatePreferenceScore(
      individual.route,
      constraints.memberPreferences
    );
    fitness += preferenceScore * 0.2;
    
    // 4. 訪問順序の論理性スコア
    const logicalOrderScore = this.calculateLogicalOrderScore(individual.route);
    fitness += logicalOrderScore * 0.2;
    
    return fitness * 100;
  }

  // トーナメント選択
  private selectParents(population: EvaluatedIndividual[]): Individual[] {
    const selected: Individual[] = [];
    const tournamentSize = 5;
    
    while (selected.length < this.config.populationSize) {
      // トーナメント参加者をランダムに選択
      const tournament = [];
      for (let i = 0; i < tournamentSize; i++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }
      
      // 最も適応度の高い個体を選択
      const winner = tournament.reduce((best, current) => 
        current.fitness > best.fitness ? current : best
      );
      
      selected.push(winner);
    }
    
    return selected;
  }

  // 順序交叉（Order Crossover - OX）
  private crossover(parents: Individual[]): Individual[] {
    const offspring: Individual[] = [];
    
    for (let i = 0; i < parents.length; i += 2) {
      if (Math.random() < this.config.crossoverRate && i + 1 < parents.length) {
        const [child1, child2] = this.orderCrossover(
          parents[i], 
          parents[i + 1]
        );
        offspring.push(child1, child2);
      } else {
        offspring.push(parents[i]);
        if (i + 1 < parents.length) {
          offspring.push(parents[i + 1]);
        }
      }
    }
    
    return offspring;
  }

  // 順序交叉の実装
  private orderCrossover(
    parent1: Individual, 
    parent2: Individual
  ): [Individual, Individual] {
    const size = parent1.route.length;
    const start = Math.floor(Math.random() * (size - 2)) + 1; // 出発地は固定
    const end = Math.floor(Math.random() * (size - start - 1)) + start + 1;
    
    // 子1の生成
    const child1Route = new Array(size).fill(null);
    child1Route[0] = parent1.route[0]; // 出発地固定
    child1Route[size - 1] = parent1.route[size - 1]; // 目的地固定
    
    // 親1から部分配列をコピー
    for (let i = start; i < end; i++) {
      child1Route[i] = parent1.route[i];
    }
    
    // 親2から残りの要素を順番に埋める
    let currentIndex = 1; // 出発地の次から
    for (const place of parent2.route) {
      if (!child1Route.includes(place) && 
          place.id !== parent1.route[0].id && 
          place.id !== parent1.route[size - 1].id) {
        while (child1Route[currentIndex] !== null) {
          currentIndex++;
        }
        child1Route[currentIndex] = place;
      }
    }
    
    // 同様に子2を生成
    const child2Route = this.createChild2Route(parent1, parent2, start, end);
    
    return [
      { route: child1Route, fitness: 0, totalDistance: 0, totalTime: 0 },
      { route: child2Route, fitness: 0, totalDistance: 0, totalTime: 0 }
    ];
  }

  // 突然変異（2-opt改善）
  private mutate(
    population: Individual[],
    constraints: OptimizationConstraints
  ): Individual[] {
    return population.map(individual => {
      if (Math.random() < this.config.mutationRate) {
        // 2-opt突然変異：ルートの一部を反転
        const mutated = [...individual.route];
        const size = mutated.length;
        
        // 出発地と目的地以外の部分で2点を選択
        const i = Math.floor(Math.random() * (size - 3)) + 1;
        const j = Math.floor(Math.random() * (size - i - 2)) + i + 1;
        
        // 選択された区間を反転
        while (i < j) {
          [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
          i++;
          j--;
        }
        
        return {
          ...individual,
          route: mutated
        };
      }
      return individual;
    });
  }

  // エリート保存戦略による次世代生成
  private createNextGeneration(
    currentPopulation: EvaluatedIndividual[],
    offspring: Individual[]
  ): Individual[] {
    // 現在の集団をfitness順にソート
    const sorted = [...currentPopulation].sort((a, b) => b.fitness - a.fitness);
    
    // エリート個体を保存
    const elites = sorted.slice(0, this.config.eliteSize);
    
    // 残りの枠を子孫で埋める
    const nextGeneration = [
      ...elites,
      ...offspring.slice(0, this.config.populationSize - this.config.eliteSize)
    ];
    
    return nextGeneration;
  }

  // 収束判定
  private hasConverged(population: Individual[]): boolean {
    const fitnesses = population.map(ind => ind.fitness);
    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const maxFitness = Math.max(...fitnesses);
    
    // 平均適応度が最大適応度の95%以上なら収束とみなす
    return avgFitness > maxFitness * 0.95;
  }
}
```

## ステップ10: 詳細スケジュール生成

### 実装ファイル: `project/src/services/DetailedScheduleService.ts`

```typescript
// DetailedScheduleService.ts:1-350
export class DetailedScheduleService {
  private googlePlacesService: GooglePlacesService;
  private routeCalculator: RealisticRouteCalculator;

  constructor() {
    this.googlePlacesService = GooglePlacesService.getInstance();
    this.routeCalculator = new RealisticRouteCalculator();
  }

  // 詳細スケジュール生成のメインメソッド
  async generateDetailedSchedule(
    optimizedRoute: OptimizedRoute,
    tripSettings: TripSettings
  ): Promise<DetailedSchedule> {
    const { places, segments, startTime, travelMode } = optimizedRoute;
    
    // 1. 各場所の詳細情報を取得
    const placeDetails = await this.fetchAllPlaceDetails(places);
    
    // 2. タイムラインイベントの生成
    const timelineEvents = await this.createTimelineEvents(
      placeDetails,
      segments,
      startTime,
      travelMode
    );
    
    // 3. 営業時間との調整
    const adjustedEvents = await this.adjustForOpeningHours(
      timelineEvents,
      placeDetails
    );
    
    // 4. 休憩時間の挿入
    const eventsWithBreaks = this.insertBreakTimes(adjustedEvents, tripSettings);
    
    // 5. 最終的なスケジュールの構築
    return this.buildDetailedSchedule(eventsWithBreaks, optimizedRoute);
  }

  // タイムラインイベントの作成
  private async createTimelineEvents(
    places: PlaceDetail[],
    segments: RouteSegment[],
    startTime: Date,
    travelMode: TravelMode
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    let currentTime = new Date(startTime);
    
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      
      // 移動イベント（最初の場所以外）
      if (i > 0) {
        const segment = segments[i - 1];
        const travelEvent: TimelineEvent = {
          type: 'travel',
          startTime: new Date(currentTime),
          endTime: new Date(
            currentTime.getTime() + segment.duration.value * 1000
          ),
          duration: segment.duration.value,
          from: places[i - 1],
          to: place,
          distance: segment.distance,
          travelMode,
          route: segment.steps
        };
        
        events.push(travelEvent);
        currentTime = travelEvent.endTime;
      }
      
      // 訪問イベント
      const visitDuration = this.calculateVisitDuration(place);
      const visitEvent: TimelineEvent = {
        type: 'visit',
        startTime: new Date(currentTime),
        endTime: new Date(currentTime.getTime() + visitDuration * 60000),
        duration: visitDuration * 60, // 秒単位
        place,
        activities: this.suggestActivities(place),
        estimatedCost: this.estimateCost(place)
      };
      
      events.push(visitEvent);
      currentTime = visitEvent.endTime;
    }
    
    return events;
  }

  // 訪問時間の計算（場所のタイプに基づく）
  private calculateVisitDuration(place: PlaceDetail): number {
    const baseDurations: Record<string, number> = {
      'museum': 120,
      'art_gallery': 90,
      'amusement_park': 240,
      'restaurant': 90,
      'cafe': 60,
      'shopping_mall': 120,
      'park': 60,
      'tourist_attraction': 60,
      'zoo': 180,
      'aquarium': 120,
      'temple': 45,
      'shrine': 45,
      'church': 45,
      'beach': 120,
      'spa': 180,
      'default': 60
    };
    
    // 場所のタイプから基本時間を決定
    let duration = baseDurations.default;
    for (const type of place.types || []) {
      if (baseDurations[type]) {
        duration = baseDurations[type];
        break;
      }
    }
    
    // 評価やレビュー数による調整
    if (place.rating && place.rating > 4.5 && place.userRatingsTotal > 1000) {
      duration *= 1.2; // 人気の場所は滞在時間を長めに
    }
    
    return duration;
  }

  // 営業時間を考慮したスケジュール調整
  private async adjustForOpeningHours(
    events: TimelineEvent[],
    placeDetails: PlaceDetail[]
  ): Promise<TimelineEvent[]> {
    const adjustedEvents: TimelineEvent[] = [];
    
    for (const event of events) {
      if (event.type === 'visit' && event.place) {
        const openingHours = event.place.openingHours;
        
        if (openingHours) {
          const adjustedEvent = this.adjustVisitTime(event, openingHours);
          adjustedEvents.push(adjustedEvent);
          
          // 待機時間が発生した場合は待機イベントを追加
          if (adjustedEvent.waitTime && adjustedEvent.waitTime > 0) {
            const waitEvent: TimelineEvent = {
              type: 'wait',
              startTime: event.startTime,
              endTime: adjustedEvent.startTime,
              duration: adjustedEvent.waitTime,
              reason: `Waiting for ${event.place.name} to open`,
              nearbyOptions: await this.findNearbyOptions(
                event.place.location,
                adjustedEvent.waitTime
              )
            };
            adjustedEvents.splice(adjustedEvents.length - 1, 0, waitEvent);
          }
        } else {
          adjustedEvents.push(event);
        }
      } else {
        adjustedEvents.push(event);
      }
    }
    
    return adjustedEvents;
  }

  // 訪問時間の調整
  private adjustVisitTime(
    event: TimelineEvent,
    openingHours: OpeningHours
  ): TimelineEvent {
    const dayOfWeek = event.startTime.getDay();
    const todayPeriods = openingHours.periods.filter(
      period => period.open.day === dayOfWeek
    );
    
    if (todayPeriods.length === 0) {
      // 本日休業
      return {
        ...event,
        isClosed: true,
        reason: 'Closed today'
      };
    }
    
    // 営業時間内かチェック
    const eventStartMinutes = 
      event.startTime.getHours() * 60 + event.startTime.getMinutes();
    
    for (const period of todayPeriods) {
      const openMinutes = period.open.hours * 60 + period.open.minutes;
      const closeMinutes = period.close 
        ? period.close.hours * 60 + period.close.minutes 
        : 24 * 60;
      
      if (eventStartMinutes < openMinutes) {
        // 開店前 - 待機時間を計算
        const waitMinutes = openMinutes - eventStartMinutes;
        const newStartTime = new Date(
          event.startTime.getTime() + waitMinutes * 60000
        );
        
        return {
          ...event,
          startTime: newStartTime,
          endTime: new Date(newStartTime.getTime() + event.duration * 1000),
          waitTime: waitMinutes * 60,
          adjustmentReason: 'Adjusted to opening time'
        };
      } else if (eventStartMinutes >= openMinutes && eventStartMinutes < closeMinutes) {
        // 営業時間内 - 調整不要
        return event;
      }
    }
    
    // 営業時間外
    return {
      ...event,
      isClosed: true,
      reason: 'Outside operating hours'
    };
  }

  // 休憩時間の自動挿入
  private insertBreakTimes(
    events: TimelineEvent[],
    settings: TripSettings
  ): TimelineEvent[] {
    const eventsWithBreaks: TimelineEvent[] = [];
    let lastMealTime: Date | null = null;
    let totalWalkingDistance = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      eventsWithBreaks.push(event);
      
      // 歩行距離の累積
      if (event.type === 'travel' && event.travelMode === 'WALKING') {
        totalWalkingDistance += event.distance?.value || 0;
      }
      
      // 食事時間のチェック
      const currentHour = event.endTime.getHours();
      const timeSinceLastMeal = lastMealTime 
        ? (event.endTime.getTime() - lastMealTime.getTime()) / 3600000 
        : 24;
      
      // 昼食時間（11:30-14:00）
      if (currentHour >= 11.5 && currentHour <= 14 && timeSinceLastMeal > 3) {
        const lunchBreak = this.createMealBreak('lunch', event.endTime);
        eventsWithBreaks.push(lunchBreak);
        lastMealTime = lunchBreak.endTime;
      }
      
      // 夕食時間（18:00-20:00）
      else if (currentHour >= 18 && currentHour <= 20 && timeSinceLastMeal > 3) {
        const dinnerBreak = this.createMealBreak('dinner', event.endTime);
        eventsWithBreaks.push(dinnerBreak);
        lastMealTime = dinnerBreak.endTime;
      }
      
      // 休憩（3km以上歩いた場合）
      if (totalWalkingDistance > 3000) {
        const restBreak: TimelineEvent = {
          type: 'break',
          startTime: event.endTime,
          endTime: new Date(event.endTime.getTime() + 15 * 60000),
          duration: 15 * 60,
          reason: 'Rest break after walking',
          suggestion: 'Find a nearby cafe or bench to rest'
        };
        eventsWithBreaks.push(restBreak);
        totalWalkingDistance = 0;
      }
    }
    
    return eventsWithBreaks;
  }
}
```

## ステップ11: プログレス可視化

### 実装ファイル: `project/src/services/OptimizationProgressService.ts`

```typescript
// OptimizationProgressService.ts:1-200
export class OptimizationProgressService {
  private subscribers: Map<string, ProgressSubscriber> = new Map();
  private progressData: Map<string, OptimizationProgress> = new Map();

  // プログレス更新の購読
  subscribe(
    optimizationId: string,
    callback: (progress: OptimizationProgress) => void
  ): () => void {
    const subscriber: ProgressSubscriber = {
      id: crypto.randomUUID(),
      callback
    };
    
    if (!this.subscribers.has(optimizationId)) {
      this.subscribers.set(optimizationId, subscriber);
    }
    
    // 既存のプログレスデータがあれば即座に通知
    const existingProgress = this.progressData.get(optimizationId);
    if (existingProgress) {
      callback(existingProgress);
    }
    
    // アンサブスクライブ関数を返す
    return () => {
      this.subscribers.delete(optimizationId);
    };
  }

  // プログレス更新
  updateProgress(optimizationId: string, progress: OptimizationProgress): void {
    this.progressData.set(optimizationId, progress);
    
    const subscriber = this.subscribers.get(optimizationId);
    if (subscriber) {
      subscriber.callback(progress);
    }
  }

  // 最適化の各フェーズでの更新
  reportPhaseProgress(
    optimizationId: string,
    phase: OptimizationPhase,
    details: PhaseDetails
  ): void {
    const progress: OptimizationProgress = {
      phase,
      percentage: this.calculatePercentage(phase, details),
      message: this.generateProgressMessage(phase, details),
      details,
      timestamp: new Date()
    };
    
    this.updateProgress(optimizationId, progress);
  }

  // フェーズごとの進捗率計算
  private calculatePercentage(
    phase: OptimizationPhase,
    details: PhaseDetails
  ): number {
    const phaseWeights = {
      'initialization': { start: 0, weight: 5 },
      'place_selection': { start: 5, weight: 15 },
      'route_calculation': { start: 20, weight: 20 },
      'genetic_optimization': { start: 40, weight: 40 },
      'schedule_generation': { start: 80, weight: 15 },
      'finalization': { start: 95, weight: 5 }
    };
    
    const phaseInfo = phaseWeights[phase];
    if (!phaseInfo) return 0;
    
    const phaseProgress = details.subProgress || 0;
    return phaseInfo.start + (phaseProgress * phaseInfo.weight / 100);
  }

  // 進捗メッセージの生成
  private generateProgressMessage(
    phase: OptimizationPhase,
    details: PhaseDetails
  ): string {
    const messages: Record<OptimizationPhase, string> = {
      'initialization': 'Initializing optimization...',
      'place_selection': `Selecting optimal places... (${details.placesProcessed}/${details.totalPlaces} places)`,
      'route_calculation': 'Calculating initial routes...',
      'genetic_optimization': `Optimizing route... Generation ${details.generation}/${details.totalGenerations}`,
      'schedule_generation': 'Generating detailed schedule...',
      'finalization': 'Finalizing optimization results...'
    };
    
    return messages[phase] || 'Processing...';
  }
}

// React Componentでの使用例
export const OptimizationProgressVisualization: React.FC<{
  optimizationId: string
}> = ({ optimizationId }) => {
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  
  useEffect(() => {
    const progressService = new OptimizationProgressService();
    const unsubscribe = progressService.subscribe(
      optimizationId,
      (newProgress) => {
        setProgress(newProgress);
      }
    );
    
    return unsubscribe;
  }, [optimizationId]);
  
  if (!progress) {
    return <div>Waiting for optimization to start...</div>;
  }
  
  return (
    <div className="optimization-progress">
      <div className="progress-header">
        <h3>{progress.message}</h3>
        <span className="percentage">{Math.round(progress.percentage)}%</span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      
      {progress.phase === 'genetic_optimization' && progress.details && (
        <div className="optimization-details">
          <div className="detail-item">
            <span>Generation:</span>
            <span>{progress.details.generation}/{progress.details.totalGenerations}</span>
          </div>
          <div className="detail-item">
            <span>Best Fitness:</span>
            <span>{progress.details.bestFitness?.toFixed(2)}</span>
          </div>
          <div className="detail-item">
            <span>Population Diversity:</span>
            <span>{progress.details.diversity?.toFixed(2)}%</span>
          </div>
        </div>
      )}
      
      {progress.phase === 'place_selection' && progress.details && (
        <div className="place-selection-details">
          <div className="places-grid">
            {progress.details.currentPlaces?.map((place, index) => (
              <div key={index} className="place-item">
                <span className="place-name">{place.name}</span>
                <span className="place-score">{place.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

## ステップ12: キープアライブ処理

### 実装ファイル: `project/src/services/OptimizationKeepAliveService.ts`

```typescript
// OptimizationKeepAliveService.ts:1-150
export class OptimizationKeepAliveService {
  private activeOptimizations: Map<string, KeepAliveSession> = new Map();
  private keepAliveInterval = 30000; // 30秒
  private maxTimeout = 600000; // 10分

  // 最適化セッションの開始
  startSession(
    optimizationId: string,
    abortController: AbortController
  ): void {
    const session: KeepAliveSession = {
      id: optimizationId,
      startTime: new Date(),
      lastPing: new Date(),
      abortController,
      intervalId: null,
      status: 'active'
    };
    
    // 定期的なキープアライブ送信
    session.intervalId = setInterval(() => {
      this.sendKeepAlive(session);
    }, this.keepAliveInterval);
    
    this.activeOptimizations.set(optimizationId, session);
  }

  // キープアライブ信号の送信
  private async sendKeepAlive(session: KeepAliveSession): Promise<void> {
    try {
      // タイムアウトチェック
      const elapsed = Date.now() - session.startTime.getTime();
      if (elapsed > this.maxTimeout) {
        console.warn(`Optimization ${session.id} exceeded max timeout`);
        this.terminateSession(session.id, 'timeout');
        return;
      }
      
      // Edge Functionへのキープアライブ送信
      const response = await fetch('/api/optimization/keepalive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          optimizationId: session.id,
          timestamp: new Date().toISOString()
        }),
        signal: session.abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`KeepAlive failed: ${response.status}`);
      }
      
      session.lastPing = new Date();
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`Optimization ${session.id} was aborted`);
        this.terminateSession(session.id, 'aborted');
      } else {
        console.error(`KeepAlive error for ${session.id}:`, error);
        this.handleKeepAliveError(session);
      }
    }
  }

  // エラーハンドリング
  private handleKeepAliveError(session: KeepAliveSession): void {
    // 最後のpingから一定時間経過していたら終了
    const timeSinceLastPing = Date.now() - session.lastPing.getTime();
    if (timeSinceLastPing > this.keepAliveInterval * 3) {
      this.terminateSession(session.id, 'connection_lost');
    }
  }

  // セッションの終了
  terminateSession(
    optimizationId: string, 
    reason: 'completed' | 'timeout' | 'aborted' | 'connection_lost'
  ): void {
    const session = this.activeOptimizations.get(optimizationId);
    if (!session) return;
    
    // インターバルのクリア
    if (session.intervalId) {
      clearInterval(session.intervalId);
    }
    
    // アボートシグナルの送信
    if (reason !== 'completed' && !session.abortController.signal.aborted) {
      session.abortController.abort();
    }
    
    // セッションの削除
    this.activeOptimizations.delete(optimizationId);
    
    // 終了通知
    this.notifySessionEnd(optimizationId, reason);
  }

  // セッション終了の通知
  private notifySessionEnd(
    optimizationId: string,
    reason: string
  ): void {
    // イベントの発行
    window.dispatchEvent(
      new CustomEvent('optimization-session-end', {
        detail: { optimizationId, reason }
      })
    );
  }

  // すべてのセッションのクリーンアップ
  cleanup(): void {
    this.activeOptimizations.forEach((session, id) => {
      this.terminateSession(id, 'aborted');
    });
    this.activeOptimizations.clear();
  }
}

// 使用例
export const useOptimizationKeepAlive = (optimizationId: string | null) => {
  const keepAliveService = useRef<OptimizationKeepAliveService>(
    new OptimizationKeepAliveService()
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  
  useEffect(() => {
    if (optimizationId) {
      abortControllerRef.current = new AbortController();
      keepAliveService.current.startSession(
        optimizationId,
        abortControllerRef.current
      );
    }
    
    return () => {
      if (optimizationId) {
        keepAliveService.current.terminateSession(
          optimizationId,
          'completed'
        );
      }
    };
  }, [optimizationId]);
  
  const cancelOptimization = useCallback(() => {
    if (optimizationId && abortControllerRef.current) {
      abortControllerRef.current.abort();
      keepAliveService.current.terminateSession(optimizationId, 'aborted');
    }
  }, [optimizationId]);
  
  return { cancelOptimization };
};
```