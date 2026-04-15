import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/integrations/supabase/client';

export default function DataLoader({ children }: { children: React.ReactNode }) {
  const { fetchAll, loaded } = useStore();

  useEffect(() => {
    fetchAll();

    // Subscribe to realtime changes on all data tables
    const channel = supabase
      .channel('all-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consignments' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loading_list_entries' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'old_nylam_goods' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'remaining_ctns' }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

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
