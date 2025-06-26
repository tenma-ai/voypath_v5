'use client';

import { ReactNode, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTrip } from '@/lib/contexts/trip-context';
import { createClient } from '@/lib/supabase/client';
import { useGuestStore } from '@/lib/stores/guest-store';

interface MyTripLayoutProps {
  children: ReactNode;
}

export default function MyTripLayout({ children }: MyTripLayoutProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tripId = searchParams.get('id');
  const { activeTrip, setActiveTrip } = useTrip();
  const { sessionId } = useGuestStore();

  // URLからトリップIDを取得して状態を更新
  useEffect(() => {
    const loadTripData = async () => {
      if (!sessionId) return;

      // トリップIDがない場合は、前回のトリップIDを使用
      if (!tripId && activeTrip) {
        // 現在のページにトリップIDを追加
        router.replace(`${pathname}?id=${activeTrip.id}`);
        return;
      }

      // トリップIDがあるが、現在のアクティブトリップと異なる場合
      if (tripId && (!activeTrip || tripId !== activeTrip.id)) {
        const supabase = createClient();
        const { data } = await supabase
          .from('trip_groups')
          .select('*')
          .eq('id', tripId)
          .single();
        
        if (data) {
          setActiveTrip(data);
          
          // トリップIDをストレージに保存
          supabase
            .from('user_settings')
            .upsert({
              session_id: sessionId,
              setting_key: 'last_active_trip',
              setting_value: data.id,
              updated_at: new Date().toISOString()
            }, { onConflict: 'session_id,setting_key' })
            .then(() => console.log('Trip ID saved'));
        }
      }
    };

    loadTripData();
  }, [tripId, activeTrip, setActiveTrip, pathname, router, sessionId]);

  return (
    <div className="trip-context-wrapper">
      {children}
    </div>
  );
} 