import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/integrations/supabase/client';

export default function DataLoader({ children }: { children: React.ReactNode }) {
  const { fetchAll, loaded } = useStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFetchAll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAll();
    }, 1000);
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('all-data-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'consignments' }, () => debouncedFetchAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loading_list_entries' }, () => debouncedFetchAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'old_nylam_goods' }, () => debouncedFetchAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'remaining_ctns' }, () => debouncedFetchAll())
        .subscribe();
    } catch (err) {
      console.error('Realtime subscription error:', err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchAll, debouncedFetchAll]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-bold">Loading data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
