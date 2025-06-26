'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FixedLayoutWrapperProps {
  children: ReactNode;
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  className?: string;
}

/**
 * 固定レイアウトラッパー
 * トップバーとボトムナビゲーションを固定し、
 * メインコンテンツのみスクロール可能にする
 */
export function FixedLayoutWrapper({
  children,
  topBar,
  bottomNav,
  className
}: FixedLayoutWrapperProps) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* トップバー固定 */}
      {topBar && (
        <header className="flex-shrink-0 z-50 bg-background border-b">
          {topBar}
        </header>
      )}
      
      {/* メインコンテンツ（スクロール可能） */}
      <main 
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          "relative",
          bottomNav && "pb-16", // ボトムナビの高さ分パディング
          className
        )}
      >
        {children}
      </main>
      
      {/* ボトムナビゲーション固定 */}
      {bottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
          {bottomNav}
        </nav>
      )}
    </div>
  );
}

/**
 * マップ/カレンダービュー用の固定コンテナ
 * ビュー内でのスクロール・拡大を制限
 */
export function ViewportContainer({
  children,
  className,
  enableZoom = false,
  enableScroll = true
}: {
  children: ReactNode;
  className?: string;
  enableZoom?: boolean;
  enableScroll?: boolean;
}) {
  return (
    <div 
      className={cn(
        "relative w-full h-full",
        enableScroll ? "overflow-auto" : "overflow-hidden",
        className
      )}
      style={{
        touchAction: enableZoom ? 'auto' : 'pan-x pan-y',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {children}
    </div>
  );
}

/**
 * マップビュー専用コンテナ
 */
export function MapViewContainer({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ViewportContainer
      enableZoom={true}
      enableScroll={false}
      className={cn(
        "rounded-lg border",
        className
      )}
    >
      {children}
    </ViewportContainer>
  );
}

/**
 * カレンダービュー専用コンテナ
 */
export function CalendarViewContainer({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ViewportContainer
      enableZoom={false}
      enableScroll={true}
      className={cn(
        "rounded-lg border",
        className
      )}
    >
      {children}
    </ViewportContainer>
  );
}