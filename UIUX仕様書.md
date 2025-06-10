# Voypath UI/UX仕様書

## 1. 概要

### 1.1 設計原則
実装は全て英語で行うこと
- **ユーザー中心設計**: 直感的で使いやすいインターフェース
- **レスポンシブデザイン**: 全デバイスでの一貫したユーザー体験
- **アクセシビリティ**: WCAG 2.1 AA準拠
- **パフォーマンス**: 滑らかなアニメーションと高速レスポンス
- **一貫性**: 統一されたデザインシステム

### 1.2 技術仕様
- **フレームワーク**: React 18+ with TypeScript
- **スタイリング**: Tailwind CSS
- **アニメーション**: Framer Motion
- **アイコン**: Lucide React
- **状態管理**: Zustand (サーバーサイド同期)
- **ルーティング**: React Router DOM

## 2. デザインシステム

### 2.1 カラーパレット

#### 2.1.1 プライマリーカラー
```css
/* Primary Colors */
--primary-50: #eff6ff;
--primary-100: #dbeafe;
--primary-200: #bfdbfe;
--primary-300: #93c5fd;
--primary-400: #60a5fa;
--primary-500: #3b82f6;  /* Main Primary */
--primary-600: #2563eb;
--primary-700: #1d4ed8;
--primary-800: #1e40af;
--primary-900: #1e3a8a;
```

#### 2.1.2 セカンダリーカラー
```css
/* Secondary Colors */
--secondary-50: #f0f9ff;
--secondary-100: #e0f2fe;
--secondary-200: #bae6fd;
--secondary-300: #7dd3fc;
--secondary-400: #38bdf8;
--secondary-500: #0ea5e9;  /* Main Secondary */
--secondary-600: #0284c7;
--secondary-700: #0369a1;
--secondary-800: #075985;
--secondary-900: #0c4a6e;
```

#### 2.1.3 アクセントカラー
```css
/* Accent Colors */
--accent-50: #fef2f2;
--accent-100: #fee2e2;
--accent-200: #fecaca;
--accent-300: #fca5a5;
--accent-400: #f87171;
--accent-500: #ef4444;  /* Main Accent */
--accent-600: #dc2626;
--accent-700: #b91c1c;
--accent-800: #991b1b;
--accent-900: #7f1d1d;
```

#### 2.1.4 サクセス・ワーニング・エラー
```css
/* Success */
--success-500: #22c55e;
--success-600: #16a34a;

/* Warning */
--warning-500: #f59e0b;
--warning-600: #d97706;

/* Error */
--error-500: #ef4444;
--error-600: #dc2626;
```

#### 2.1.5 ニュートラル（グレースケール）
```css
/* Light Mode */
--slate-50: #f8fafc;
--slate-100: #f1f5f9;
--slate-200: #e2e8f0;
--slate-300: #cbd5e1;
--slate-400: #94a3b8;
--slate-500: #64748b;
--slate-600: #475569;
--slate-700: #334155;
--slate-800: #1e293b;
--slate-900: #0f172a;

/* Dark Mode */
--slate-dark-50: #0f172a;
--slate-dark-100: #1e293b;
--slate-dark-200: #334155;
--slate-dark-300: #475569;
--slate-dark-400: #64748b;
--slate-dark-500: #94a3b8;
--slate-dark-600: #cbd5e1;
--slate-dark-700: #e2e8f0;
--slate-dark-800: #f1f5f9;
--slate-dark-900: #f8fafc;
```

### 2.2 タイポグラフィ

#### 2.2.1 フォントファミリー
```css
/* Primary Font */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Display Font */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

#### 2.2.2 フォントサイズとウェイト
```css
/* Font Sizes */
.text-2xs: 0.625rem;  /* 10px */
.text-xs: 0.75rem;    /* 12px */
.text-sm: 0.875rem;   /* 14px */
.text-base: 1rem;     /* 16px */
.text-lg: 1.125rem;   /* 18px */
.text-xl: 1.25rem;    /* 20px */
.text-2xl: 1.5rem;    /* 24px */
.text-3xl: 1.875rem;  /* 30px */
.text-4xl: 2.25rem;   /* 36px */
.text-5xl: 3rem;      /* 48px */
.text-6xl: 3.75rem;   /* 60px */

/* Font Weights */
.font-light: 300;
.font-normal: 400;
.font-medium: 500;
.font-semibold: 600;
.font-bold: 700;
```

#### 2.2.3 行間とレターススペーシング
```css
/* Line Heights */
.leading-tight: 1.25;
.leading-snug: 1.375;
.leading-normal: 1.5;
.leading-relaxed: 1.625;
.leading-loose: 2;

/* Letter Spacing */
.tracking-tighter: -0.05em;
.tracking-tight: -0.025em;
.tracking-normal: 0em;
.tracking-wide: 0.025em;
.tracking-wider: 0.05em;
```

### 2.3 シャドウとエフェクト

#### 2.3.1 カスタムシャドウ
```css
/* Soft Shadows */
.shadow-soft: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
.shadow-medium: 0 4px 6px rgba(0, 0, 0, 0.1);
.shadow-hard: 0 10px 25px rgba(0, 0, 0, 0.15);

/* Glow Effects */
.shadow-glow: 0 0 20px rgba(59, 130, 246, 0.3);
.shadow-glow-lg: 0 0 40px rgba(59, 130, 246, 0.2);

/* Inner Shadows */
.shadow-inner-soft: inset 0 2px 4px rgba(0, 0, 0, 0.06);

/* Glass Effect */
.shadow-glass: 0 8px 32px rgba(31, 38, 135, 0.37);
```

#### 2.3.2 ブラー効果
```css
.backdrop-blur-xs: backdrop-filter: blur(2px);
.backdrop-blur-sm: backdrop-filter: blur(4px);
.backdrop-blur: backdrop-filter: blur(8px);
.backdrop-blur-md: backdrop-filter: blur(12px);
.backdrop-blur-lg: backdrop-filter: blur(16px);
.backdrop-blur-xl: backdrop-filter: blur(24px);
.backdrop-blur-2xl: backdrop-filter: blur(40px);
.backdrop-blur-3xl: backdrop-filter: blur(64px);
```

### 2.4 ボーダーラディウス
```css
.rounded-2xs: 0.125rem;  /* 2px */
.rounded-xs: 0.25rem;    /* 4px */
.rounded-sm: 0.5rem;     /* 8px */
.rounded: 0.75rem;       /* 12px */
.rounded-md: 1rem;       /* 16px */
.rounded-lg: 1.25rem;    /* 20px */
.rounded-xl: 1.5rem;     /* 24px */
.rounded-2xl: 2rem;      /* 32px */
.rounded-3xl: 3rem;      /* 48px */
```

### 2.5 スペーシング
```css
.space-1: 0.25rem;   /* 4px */
.space-2: 0.5rem;    /* 8px */
.space-3: 0.75rem;   /* 12px */
.space-4: 1rem;      /* 16px */
.space-5: 1.25rem;   /* 20px */
.space-6: 1.5rem;    /* 24px */
.space-8: 2rem;      /* 32px */
.space-10: 2.5rem;   /* 40px */
.space-12: 3rem;     /* 48px */
.space-16: 4rem;     /* 64px */
.space-20: 5rem;     /* 80px */
.space-24: 6rem;     /* 96px */
```

## 3. コンポーネント仕様

### 3.1 レイアウトコンポーネント

#### 3.1.1 Layout.tsx
```typescript
interface LayoutProps {
  children: React.ReactNode;
}

// 構造
<div className="min-h-screen bg-slate-50 dark:bg-slate-900">
  <TopAppBar />
  <main className="pb-20 pt-16">
    <Outlet />
  </main>
  <Navigation />
  <GuestProfilePrompt />
  <PremiumModal />
</div>
```

#### 3.1.2 TopAppBar.tsx
```typescript
interface TopAppBarProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
}

// 主要クラス
- Container: "fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50"
- Header Height: "h-16"
- Back Button: "w-6 h-6 text-slate-600 dark:text-slate-300"
- Logo: "text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent"
- Actions: "flex items-center space-x-3"
```

#### 3.1.3 Navigation.tsx
```typescript
interface NavigationItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

// 主要クラス
- Container: "fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50"
- Nav Height: "h-20"
- Active Item: "bg-gradient-to-r from-primary-500 to-secondary-500 text-white"
- Inactive Item: "text-slate-600 dark:text-slate-400"
```

### 3.2 UIコンポーネント

#### 3.2.1 ボタン仕様
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline';
  size: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

// バリアント別スタイル
primary: "bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:from-primary-600 hover:to-secondary-600"
secondary: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700"
accent: "bg-gradient-to-r from-accent-500 to-red-500 text-white hover:from-accent-600 hover:to-red-600"
ghost: "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
outline: "border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-primary-300"

// サイズ別スタイル
sm: "px-3 py-1.5 text-sm"
md: "px-4 py-2 text-base"
lg: "px-6 py-3 text-lg"
xl: "px-8 py-4 text-xl"
```

#### 3.2.2 入力フィールド仕様
```typescript
interface InputProps {
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

// 主要スタイル
- Base: "w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80"
- Focus: "focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
- Error: "border-red-500 focus:ring-red-500/50"
- Disabled: "opacity-50 cursor-not-allowed"
```

#### 3.2.3 モーダル仕様
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// アニメーション設定
initial={{ opacity: 0, scale: 0.9, y: 20 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.9, y: 20 }}
transition={{ duration: 0.2, ease: "easeOut" }}

// 主要スタイル
- Overlay: "fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
- Modal: "relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
- Header: "px-6 py-4 border-b border-slate-100 dark:border-slate-700"
- Content: "px-6 py-4"
- Footer: "px-6 py-4 border-t border-slate-100 dark:border-slate-700"
```

#### 3.2.4 カード仕様
```typescript
interface CardProps {
  variant?: 'default' | 'elevated' | 'glass';
  padding?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

// バリアント別スタイル
default: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl"
elevated: "bg-white dark:bg-slate-800 rounded-2xl shadow-medium hover:shadow-hard transition-shadow"
glass: "bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl border border-white/20 dark:border-slate-700/20 rounded-2xl"
```

### 3.3 フォームコンポーネント

#### 3.3.0 CreateTripModal フォーム仕様
```typescript
interface CreateTripFormData {
  departure_location: string; // 必須：出発地（最重要フィールド）
  name?: string;              // 任意：旅行名（未入力時は"[出発地]からの旅行"で自動生成）
  destination?: string;       // 任意：目的地（placesから推定可能、"same as departure location"オプション追加）
  start_date?: Date;         // 任意：出発日（日程未確定の場合）
  end_date?: Date;           // 任意：帰国日（日程未確定の場合）
  description?: string;      // 任意：説明
}

// destination入力フィールドの新機能
interface DestinationFieldOptions {
  showSameAsDepatureOption: boolean; // "出発地と同じ"オプションを表示
  placeholder: string; // "目的地を入力するか「出発地と同じ」を選択"
  sameAsDepatureText: string; // "Same as departure location"表示テキスト
}

// フォームバリデーション
const validateCreateTrip = (data: CreateTripFormData) => {
  if (!data.departure_location?.trim()) {
    throw new Error('出発地は必須です');
  }
  
  if (data.start_date && data.end_date && data.start_date > data.end_date) {
    throw new Error('帰国日は出発日より後に設定してください');
  }
  
  // destinationが"same as departure location"の場合の処理
  if (data.destination === 'same as departure location' || data.destination === '') {
    data.destination = data.departure_location;
  }
};

// destination入力UI仕様
const DestinationInputUI = {
  // 入力フィールド
  inputField: {
    placeholder: "Enter destination or select 'Same as departure location'",
    className: "w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl",
    clearable: true,
  },
  
  // "Same as departure location" オプション
  sameAsDepatureOption: {
    type: "button",
    text: "Same as departure location",
    className: "w-full mt-2 p-2 text-left text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl",
    icon: "MapPin", // Lucide icon
  },
  
  // 選択状態の表示
  selectedState: {
    showDepartureLocationCopy: true,
    className: "text-primary-600 dark:text-primary-400 font-medium",
    indicator: "✓ Same as departure location"
  }
};
```

#### 3.3.1 DurationSlider.tsx
```typescript
interface DurationSliderProps {
  value: number; // 分単位
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

// スタイル
- Track: "h-3 bg-slate-200 dark:bg-slate-700 rounded-full"
- Thumb: "w-6 h-6 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
- Value Display: "text-sm font-medium text-slate-700 dark:text-slate-300"
```

#### 3.3.2 StarRating.tsx
```typescript
interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// スタイル
- Active Star: "text-yellow-400 fill-current"
- Inactive Star: "text-slate-300 dark:text-slate-600"
- Hover Effect: "hover:text-yellow-300 transition-colors"
```

## 4. 画面仕様

### 4.1 HomePage.tsx

#### 4.1.1 レイアウト構造
```typescript
// コンポーネント階層
<AnimatedPage>
  <GuestProfilePrompt /> // 条件付き表示
  <WelcomeSection />
  <QuickStats />
  <ActionButtons />
  <TripsSection />
  <PremiumUpgradeSection /> // 非プレミアムユーザーのみ
</AnimatedPage>
```

#### 4.1.2 主要セクション

**ウェルカムセクション**
```typescript
// スタイル
- Container: "text-center space-y-6 px-6 py-8"
- Title: "text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600 bg-clip-text text-transparent"
- Subtitle: "text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto"
- Premium Badge: "inline-flex items-center px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 rounded-full text-sm font-medium"
```

**クイックスタッツ**
```typescript
// 3列グリッドレイアウト
- Container: "grid grid-cols-3 gap-4 px-6 py-4"
- Stat Card: "text-center p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-soft"
- Value: "text-2xl font-bold text-primary-600 dark:text-primary-400"
- Label: "text-sm text-slate-600 dark:text-slate-400"
```

**アクションボタン**
```typescript
// 2列グリッドレイアウト
- Container: "grid grid-cols-2 gap-4 px-6 py-4"
- Join Button: "bg-gradient-to-r from-secondary-500 to-primary-500"
- Create Button: "bg-gradient-to-r from-primary-500 to-secondary-500"
```

### 4.2 TripDetailPage.tsx

#### 4.2.1 レイアウト構造
```typescript
<AnimatedPage>
  <TripHeader />
  <ViewToggle />
  <AnimatePresence mode="wait">
    {activeView === 'map' && <MapView />}
    {activeView === 'timeline' && <ListView />}
    {activeView === 'calendar' && <CalendarView />}
  </AnimatePresence>
  <FloatingOptimizeButton />
</AnimatedPage>
```

#### 4.2.2 ビュー切り替え
```typescript
// アニメーション設定
const viewVariants = {
  initial: { opacity: 0, x: 20, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -20, scale: 0.98 }
};

const transition = { duration: 0.4, ease: "easeInOut" };
```

#### 4.2.3 フローティングボタン
```typescript
// 最適化ボタンスタイル
- Position: "fixed bottom-24 right-6 z-40"
- Button: "w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full shadow-glow-lg"
- Icon: "w-8 h-8 text-white"
- Animation: "hover:scale-110 transition-transform"
```

### 4.3 AddPlacePage.tsx

#### 4.3.1 レイアウト構造
```typescript
<AnimatedPage>
  <PlaceLimitWarning /> // 非プレミアムユーザー
  <DeadlineWarning /> // 締切設定時
  <SearchSection />
  <AnimatePresence>
    {selectedPlace && <PlaceDetailsForm />}
  </AnimatePresence>
</AnimatedPage>
```

#### 4.3.2 検索セクション
```typescript
// 検索バー
- Container: "relative px-6 py-4"
- Input: "w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl"
- Search Icon: "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400"

// 検索結果グリッド
- Container: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6 py-4"
- Place Card: "bg-white dark:bg-slate-800 rounded-2xl shadow-soft overflow-hidden hover:shadow-medium transition-shadow"
```

### 4.4 MyPlacesPage.tsx

#### 4.4.1 レイアウト構造
```typescript
<AnimatedPage>
  <PlacesHeader />
  <FilterTabs />
  <PlacesList />
  <EmptyState /> // 場所がない場合
</AnimatedPage>
```

#### 4.4.2 フィルタータブ
```typescript
// タブ項目
const filterTabs = [
  { key: 'all', label: 'All Places', icon: MapPin },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'unscheduled', label: 'Unscheduled', icon: Calendar },
  { key: 'high-priority', label: 'High Priority', icon: Star }
];

// タブスタイル
- Active: "bg-primary-500 text-white"
- Inactive: "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
```

### 4.5 ChatPage.tsx

#### 4.5.1 レイアウト構造
```typescript
<AnimatedPage>
  <ChatHeader />
  <MessagesList />
  <MessageInput />
</AnimatedPage>
```

#### 4.5.2 メッセージ表示
```typescript
// メッセージバブル
- Own Message: "ml-auto bg-gradient-to-r from-primary-500 to-secondary-500 text-white"
- Other Message: "mr-auto bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
- System Message: "mx-auto bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-center"
```

## 5. アニメーション仕様

### 5.1 ページ遷移アニメーション

#### 5.1.1 AnimatedPage.tsx
```typescript
const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 }
};

const pageTransition = {
  duration: 0.4,
  ease: "easeInOut"
};
```

#### 5.1.2 リストアニメーション
```typescript
const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};
```

### 5.2 モーダルアニメーション

#### 5.2.1 表示/非表示
```typescript
const modalVariants = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 20 }
};

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};
```

### 5.3 インタラクションアニメーション

#### 5.3.1 ボタンホバー
```typescript
const buttonHover = {
  scale: 1.02,
  y: -2,
  transition: { duration: 0.2 }
};

const buttonTap = {
  scale: 0.98,
  transition: { duration: 0.1 }
};
```

#### 5.3.2 カードホバー
```typescript
const cardHover = {
  y: -4,
  scale: 1.02,
  transition: { duration: 0.3, ease: "easeOut" }
};
```

## 6. レスポンシブデザイン

### 6.1 ブレークポイント
```css
/* Tailwind CSS Breakpoints */
sm: 640px   /* スマートフォン横向き、小型タブレット */
md: 768px   /* 中型タブレット */
lg: 1024px  /* 大型タブレット、小型デスクトップ */
xl: 1280px  /* デスクトップ */
2xl: 1536px /* 大型デスクトップ */
```

### 6.2 レスポンシブパターン

#### 6.2.1 グリッドレイアウト
```css
/* 旅行リスト */
.trips-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

/* 場所検索結果 */
.places-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4;
}

/* クイックスタッツ */
.stats-grid {
  @apply grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-4;
}
```

#### 6.2.2 パディングとマージン
```css
/* コンテナパディング */
.container-padding {
  @apply px-4 sm:px-6 lg:px-8;
}

/* セクションマージン */
.section-margin {
  @apply mb-6 sm:mb-8 lg:mb-12;
}
```

#### 6.2.3 フォントサイズ
```css
/* 見出し */
.heading-xl {
  @apply text-3xl sm:text-4xl md:text-5xl lg:text-6xl;
}

.heading-lg {
  @apply text-2xl sm:text-3xl md:text-4xl;
}

.heading-md {
  @apply text-xl sm:text-2xl md:text-3xl;
}

/* 本文 */
.body-text {
  @apply text-sm sm:text-base lg:text-lg;
}
```

## 7. アクセシビリティ仕様

### 7.1 セマンティックHTML
```typescript
// 適切な見出し階層
<h1>ページタイトル</h1>
<h2>セクション見出し</h2>
<h3>サブセクション見出し</h3>

// ナビゲーション
<nav aria-label="Main navigation">
  <ul role="list">
    <li><a href="/" aria-current="page">Home</a></li>
  </ul>
</nav>

// フォーム
<form>
  <label htmlFor="departureLocation">出発地 *</label>
  <input id="departureLocation" type="text" required />
  
  <label htmlFor="tripName">旅行名</label>
  <input id="tripName" type="text" placeholder="未入力時は自動生成されます" />
  
  <label htmlFor="destination">目的地</label>
  <input id="destination" type="text" placeholder="任意" />
  
  <label htmlFor="startDate">出発日</label>
  <input id="startDate" type="date" placeholder="任意" />
  
  <label htmlFor="endDate">帰国日</label>
  <input id="endDate" type="date" placeholder="任意" />
</form>
```

### 7.2 ARIA属性
```typescript
// ボタン状態
<button 
  aria-pressed={isActive}
  aria-disabled={disabled}
  aria-label="Create new trip"
>

// モーダル
<div 
  role="dialog" 
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>

// ライブリージョン
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### 7.3 キーボードナビゲーション
```typescript
// フォーカス管理
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') onClose();
  if (e.key === 'Enter') onSubmit();
  if (e.key === 'Tab') handleTabNavigation(e);
};

// フォーカストラップ
const trapFocus = (element: HTMLElement) => {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  // フォーカス制御ロジック
};
```

### 7.4 カラーコントラスト
```css
/* WCAG AA準拠コントラスト比 */
.text-primary {
  color: #1d4ed8; /* 4.5:1 以上 */
}

.text-secondary {
  color: #0369a1; /* 4.5:1 以上 */
}

.text-muted {
  color: #64748b; /* 4.5:1 以上 */
}
```

## 8. ダークモード対応

### 8.1 テーマ切り替え
```typescript
// Zustand store
interface ThemeStore {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}

// CSS変数更新
const updateTheme = (theme: string) => {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
```

### 8.2 ダークモードスタイル
```css
/* ライトモード（デフォルト） */
.bg-background {
  @apply bg-white;
}

.text-foreground {
  @apply text-slate-900;
}

/* ダークモード */
.dark .bg-background {
  @apply bg-slate-900;
}

.dark .text-foreground {
  @apply text-slate-50;
}
```

## 9. パフォーマンス最適化

### 9.1 レンダリング最適化
```typescript
// React.memo の使用
export const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* 重い処理 */}</div>;
});

// useMemo の使用
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// useCallback の使用
const handleClick = useCallback(() => {
  onItemClick(item.id);
}, [item.id, onItemClick]);
```

### 9.2 画像最適化
```typescript
// 遅延読み込み
<img 
  src={imageSrc}
  alt={imageAlt}
  loading="lazy"
  className="object-cover w-full h-48"
/>

// プレースホルダー
const [imageLoaded, setImageLoaded] = useState(false);
<div className="relative">
  {!imageLoaded && (
    <div className="absolute inset-0 bg-slate-200 animate-pulse" />
  )}
  <img 
    onLoad={() => setImageLoaded(true)}
    className={`transition-opacity duration-300 ${
      imageLoaded ? 'opacity-100' : 'opacity-0'
    }`}
  />
</div>
```

### 9.3 アニメーション最適化
```typescript
// GPU加速の活用
const optimizedAnimation = {
  transform: 'translateZ(0)', // GPU レイヤー作成
  willChange: 'transform, opacity', // ブラウザ最適化ヒント
};

// reduced-motion 対応
const respectsReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const animation = respectsReducedMotion() 
  ? { duration: 0 } 
  : { duration: 0.3 };
```

## 10. 国際化（i18n）対応

### 10.1 言語リソース構造
```typescript
// en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit"
  },
  "navigation": {
    "home": "Home",
    "myTrip": "My Trip",
    "addPlace": "Add Place",
    "chat": "Chat",
    "share": "Share"
  },
  "pages": {
    "home": {
      "welcome": "Welcome to Voypath!",
      "subtitle": "Plan your perfect trip with friends and family"
    }
  }
}
```

### 10.2 翻訳フック
```typescript
interface TranslationStore {
  language: 'en' | 'ja' | 'ko' | 'zh';
  translations: Record<string, any>;
  t: (key: string, params?: Record<string, string>) => string;
  setLanguage: (language: string) => void;
}

// 使用例
const { t } = useTranslation();
<h1>{t('pages.home.welcome')}</h1>
```

## 11. エラーハンドリングUI

### 11.1 エラーバウンダリ
```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, ErrorBoundaryState> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 11.2 エラー表示コンポーネント
```typescript
interface ErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] px-6">
    <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
      Something went wrong
    </h2>
    <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
      {error?.message || 'An unexpected error occurred'}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);
```

## 12. 品質保証

### 12.1 コンポーネントテスト
```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 12.2 アクセシビリティテスト
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(<HomePage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 12.3 視覚回帰テスト
```typescript
// Button.stories.tsx
export default {
  title: 'Components/Button',
  component: Button,
} as ComponentMeta<typeof Button>;

export const Primary: ComponentStory<typeof Button> = (args) => (
  <Button {...args}>Primary Button</Button>
);

export const Secondary: ComponentStory<typeof Button> = (args) => (
  <Button {...args} variant="secondary">Secondary Button</Button>
);
```