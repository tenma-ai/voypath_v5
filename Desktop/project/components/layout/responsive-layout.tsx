'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  children: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  className?: string;
}

export function ResponsiveLayout({ 
  children, 
  topBar, 
  bottomNav,
  className 
}: ResponsiveLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* トップバー固定 */}
      {topBar && (
        <div className="flex-shrink-0 sticky top-0 z-50 bg-background border-b">
          {topBar}
        </div>
      )}
      
      {/* メインコンテンツエリア（スクロール可能） */}
      <main className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden",
        "w-full max-w-full", // 横スクロール防止
        bottomNav && "pb-16", // ボトムナビゲーション分のパディング
        className
      )}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {children}
        </div>
      </main>
      
      {/* ボトムナビゲーション固定 */}
      {bottomNav && (
        <div className="flex-shrink-0 fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
          {bottomNav}
        </div>
      )}
    </div>
  );
}

/**
 * レスポンシブテキストコンポーネント
 * テキストが切れないように調整
 */
export function ResponsiveText({ 
  children, 
  className,
  truncate = true 
}: { 
  children: ReactNode;
  className?: string;
  truncate?: boolean;
}) {
  return (
    <div className={cn(
      "break-words", // 長い単語を改行
      truncate && "truncate", // 必要に応じて省略
      "max-w-full", // 親要素を超えない
      className
    )}>
      {children}
    </div>
  );
}

/**
 * レスポンシブカードコンポーネント
 * モバイルで適切な余白とサイズ
 */
export function ResponsiveCard({ 
  children, 
  className 
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "w-full", // 幅100%
      "overflow-hidden", // コンテンツがはみ出さない
      "rounded-lg border bg-card",
      "p-4 sm:p-6", // レスポンシブパディング
      className
    )}>
      {children}
    </div>
  );
}

/**
 * レスポンシブグリッドコンポーネント
 */
export function ResponsiveGrid({ 
  children, 
  className,
  cols = {
    default: 1,
    sm: 2,
    md: 3,
    lg: 4
  }
}: { 
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
}) {
  const gridClasses = [
    `grid`,
    `grid-cols-${cols.default || 1}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    "gap-4",
    "w-full"
  ].filter(Boolean).join(' ');
  
  return (
    <div className={cn(gridClasses, className)}>
      {children}
    </div>
  );
}

/**
 * スクロール可能エリアコンポーネント
 * MapビューやCalendarビューなど特定エリアのみスクロール
 */
export function ScrollableArea({ 
  children, 
  className,
  height = '400px'
}: { 
  children: ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <div 
      className={cn(
        "overflow-auto",
        "relative",
        "border rounded-lg",
        className
      )}
      style={{ height, maxHeight: height }}
    >
      {children}
    </div>
  );
}

/**
 * モバイル対応のボタングループ
 */
export function ResponsiveButtonGroup({ 
  children, 
  className,
  orientation = 'horizontal'
}: { 
  children: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <div className={cn(
      "flex flex-wrap gap-2",
      orientation === 'vertical' && "flex-col",
      orientation === 'horizontal' && "flex-row",
      "w-full sm:w-auto", // モバイルでフル幅
      className
    )}>
      {children}
    </div>
  );
}