import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

// Cast to any to avoid type errors when Database types haven't been generated yet
const db = supabase as any;
import type { Consignment, LoadingListEntry, OldNylamEntry, RemainingCTNEntry, KerungDetails, TatopaniDetails, LhasaDetails } from '@/types';

let cachedEmail: string | null = null;
let emailPromise: Promise<string> | null = null;

async function getCurrentUserEmail(): Promise<string> {
  if (cachedEmail) return cachedEmail;
  if (emailPromise) return emailPromise;
  emailPromise = supabase.auth.getUser().then(({ data }) => {
    cachedEmail = data?.user?.email || '';
    emailPromise = null;
    return cachedEmail;
  });
  return emailPromise;
}

// Clear cache on auth state change
supabase.auth.onAuthStateChange(() => { cachedEmail = null; });

interface AppStore {
  consignments: Consignment[];
  loadingListGuangzhou: LoadingListEntry[];
  loadingListYiwu: LoadingListEntry[];
  oldNylamGoods: OldNylamEntry[];
  remainingCTNs: RemainingCTNEntry[];
  loaded: boolean;

  fetchAll: () => Promise<void>;

  addConsignment: (c: Omit<Consignment, 'id'>) => Promise<void>;
  updateConsignment: (id: string, c: Partial<Consignment>) => Promise<void>;
  deleteConsignment: (id: string) => Promise<void>;
  setConsignments: (c: Consignment[]) => void;

  addLoadingListEntry: (entry: Omit<LoadingListEntry, 'id' | 'onTheWay' | 'missingCTN' | 'remainingCTNNylam' | 'remainingCTNLhasa'>, origin: 'guangzhou' | 'yiwu') => Promise<void>;
  updateLoadingListEntry: (id: string, origin: 'guangzhou' | 'yiwu', entry: Partial<LoadingListEntry>) => Promise<void>;
  deleteLoadingListEntry: (id: string, origin: 'guangzhou' | 'yiwu') => Promise<void>;
  setLoadingList: (origin: 'guangzhou' | 'yiwu', entries: LoadingListEntry[]) => void;

  addOldNylamEntry: (entry: Omit<OldNylamEntry, 'id'>) => Promise<void>;
  updateOldNylamEntry: (id: string, entry: Partial<OldNylamEntry>) => Promise<void>;
  deleteOldNylamEntry: (id: string) => Promise<void>;

  addRemainingCTN: (entry: Omit<RemainingCTNEntry, 'id'>) => Promise<void>;
  updateRemainingCTN: (id: string, entry: Partial<RemainingCTNEntry>) => Promise<void>;
  deleteRemainingCTN: (id: string) => Promise<void>;

  syncConsignmentToLoadingList: (c: Consignment) => void;
}

function mapConsignmentFromDb(row: any): Consignment {
  return {
    id: row.id,
    date: row.date || '',
    consignmentNo: row.consignment_no || '',
    marka: row.marka || '',
    totalCTN: Number(row.total_ctn) || 0,
    cbm: Number(row.cbm) || 0,
    gw: Number(row.gw) || 0,
    destination: row.destination || 'TATOPANI',
    status: row.status || '',
    client: row.client || '',
    remarks: row.remarks || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || '',
  };
}

function mapLoadingFromDb(row: any): LoadingListEntry {
  return {
    id: row.id,
    date: row.date || '',
    consignmentNo: row.consignment_no || '',
    marka: row.marka || '',
    totalCTN: Number(row.total_ctn) || 0,
    cbm: Number(row.cbm) || 0,
    gw: Number(row.gw) || 0,
    destination: row.destination || 'TATOPANI',
    status: row.status || '',
    client: row.client || '',
    remarks: row.remarks || '',
    lotNo: row.lot_no || '',
    dispatchedFrom: row.dispatched_from || '',
    container: row.container || '',
    arrivalDateNylam: row.arrival_date_nylam || '',
    arrivalAtLhasa: row.arrival_at_lhasa || '',
    lhasaContainer: row.lhasa_container || '',
    dispatchedFromLhasa: row.dispatched_from_lhasa || '',
    lhasa: (() => {
      const arr = (row.lhasa as LhasaDetails[]) || [];
      // Auto-migrate: seed from legacy single-Lhasa fields when array is empty
      if (arr.length === 0 && (row.lhasa_container || row.dispatched_from_lhasa)) {
        return [{ nylamContainer: row.lhasa_container || '', dispatchedFromLhasa: row.dispatched_from_lhasa || '', loadedCTN: row.total_ctn != null ? Number(row.total_ctn) : null }];
      }
      return arr;
    })(),
    kerung: (row.kerung as KerungDetails[]) || [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
    tatopani: (row.tatopani as TatopaniDetails[]) || [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
    onTheWay: row.on_the_way != null ? Number(row.on_the_way) : null,
    missingCTN: row.missing_ctn != null ? Number(row.missing_ctn) : null,
    remainingCTNNylam: row.remaining_ctn_nylam != null ? Number(row.remaining_ctn_nylam) : null,
    remainingCTNLhasa: row.remaining_ctn_lhasa != null ? Number(row.remaining_ctn_lhasa) : null,
    loadedCTNS: row.loaded_ctns != null ? Number(row.loaded_ctns) : null,
    receivedCTNLhasa: row.received_ctn_lhasa != null ? Number(row.received_ctn_lhasa) : null,
    receivedCTNNylam: row.received_ctn_nylam != null ? Number(row.received_ctn_nylam) : null,
    followUp: row.follow_up || false,
    origin: row.origin || 'guangzhou',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || '',
  };
}

function mapOldNylamFromDb(row: any): OldNylamEntry {
  return {
    id: row.id,
    date: row.date || '',
    consignmentNo: row.consignment_no || '',
    marka: row.marka || '',
    totalCTN: Number(row.total_ctn) || 0,
    ctnRemainingNylam: Number(row.ctn_remaining_nylam) || 0,
    loadedCTN: Number(row.loaded_ctn) || 0,
    cbm: Number(row.cbm) || 0,
    gw: Number(row.gw) || 0,
    destination: row.destination || '',
    dispatchedFromNylam: row.dispatched_from_nylam || '',
    nylamContainer: row.nylam_container || '',
    arrivalLocation: row.arrival_location || '',
    arrivalDate: row.arrival_date || '',
    client: row.client || '',
    followUp: row.follow_up || false,
    updatedAt: row.updated_at || '',
  };
}

function mapRemainingFromDb(row: any): RemainingCTNEntry {
  return {
    id: row.id,
    date: row.date || '',
    consignmentNo: row.consignment_no || '',
    marka: row.marka || '',
    totalCTN: Number(row.total_ctn) || 0,
    cbm: Number(row.cbm) || 0,
    gw: Number(row.gw) || 0,
    destination: row.destination || '',
    remainingCTN: Number(row.remaining_ctn) || 0,
    remainingCTNLocation: row.remaining_ctn_location || '',
    client: row.client || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || '',
  };
}

export const useStore = create<AppStore>()((set, get) => ({
  consignments: [],
  loadingListGuangzhou: [],
  loadingListYiwu: [],
  oldNylamGoods: [],
  remainingCTNs: [],
  loaded: false,

  fetchAll: async () => {
    try {
      const [c, l, o, r] = await Promise.all([
        db.from('consignments').select('*').order('created_at', { ascending: true }),
        db.from('loading_list_entries').select('*').order('created_at', { ascending: true }),
        db.from('old_nylam_goods').select('*').order('created_at', { ascending: true }),
        db.from('remaining_ctns').select('*').order('created_at', { ascending: true }),
      ]);
      set({
        consignments: (c.data || []).map(mapConsignmentFromDb),
        loadingListGuangzhou: (l.data || []).filter((r: any) => r.origin === 'guangzhou').map(mapLoadingFromDb),
        loadingListYiwu: (l.data || []).filter((r: any) => r.origin === 'yiwu').map(mapLoadingFromDb),
        oldNylamGoods: (o.data || []).map(mapOldNylamFromDb),
        remainingCTNs: (r.data || []).map(mapRemainingFromDb),
        loaded: true,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      // Still mark as loaded so the UI doesn't stay stuck on loading spinner
      set({ loaded: true });
    }
  },

  addConsignment: async (c) => {
    const email = await getCurrentUserEmail();
    const { data } = await db.from('consignments').insert({
      date: c.date, consignment_no: c.consignmentNo, marka: c.marka,
      total_ctn: c.totalCTN, cbm: c.cbm, gw: c.gw, destination: c.destination,
      status: c.status, client: c.client, remarks: c.remarks,
      created_by: email, updated_by: email,
    }).select().single();
    if (data) {
      const newC = mapConsignmentFromDb(data);
      set((s) => ({ consignments: [...s.consignments, newC] }));
      get().syncConsignmentToLoadingList(newC);
    }
  },

  updateConsignment: async (id, updates) => {
    const email = await getCurrentUserEmail();
    const dbUpdates: any = { updated_by: email };
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.consignmentNo !== undefined) dbUpdates.consignment_no = updates.consignmentNo;
    if (updates.marka !== undefined) dbUpdates.marka = updates.marka;
    if (updates.totalCTN !== undefined) dbUpdates.total_ctn = updates.totalCTN;
    if (updates.cbm !== undefined) dbUpdates.cbm = updates.cbm;
    if (updates.gw !== undefined) dbUpdates.gw = updates.gw;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.client !== undefined) dbUpdates.client = updates.client;
    if (updates.remarks !== undefined) dbUpdates.remarks = updates.remarks;
    await db.from('consignments').update(dbUpdates).eq('id', id);
    set((s) => ({
      consignments: s.consignments.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    // sync to loading list
    const updated = get().consignments.find((c) => c.id === id);
    if (updated) {
      const origin = updated.consignmentNo.startsWith('YA') || updated.consignmentNo.startsWith('YW') ? 'yiwu' : 'guangzhou';
      const list = origin === 'yiwu' ? get().loadingListYiwu : get().loadingListGuangzhou;
      const existing = list.find((e) => e.consignmentNo === updated.consignmentNo);
      if (existing) {
        get().updateLoadingListEntry(existing.id, origin, {
          date: updated.date, marka: updated.marka, totalCTN: updated.totalCTN,
          cbm: updated.cbm, gw: updated.gw, destination: updated.destination,
          status: updated.status, client: updated.client, remarks: updated.remarks,
        });
      }
    }
  },

  deleteConsignment: async (id) => {
    const c = get().consignments.find((x) => x.id === id);
    await db.from('consignments').delete().eq('id', id);
    set((s) => ({ consignments: s.consignments.filter((x) => x.id !== id) }));
    if (c) {
      const origin = c.consignmentNo.startsWith('YA') || c.consignmentNo.startsWith('YW') ? 'yiwu' : 'guangzhou';
      const list = origin === 'yiwu' ? get().loadingListYiwu : get().loadingListGuangzhou;
      const entry = list.find((e) => e.consignmentNo === c.consignmentNo);
      if (entry) get().deleteLoadingListEntry(entry.id, origin);
    }
  },

  setConsignments: (c) => set({ consignments: c }),

  addLoadingListEntry: async (entry, origin) => {
    const email = await getCurrentUserEmail();
    const { data } = await db.from('loading_list_entries').insert({
      date: entry.date, consignment_no: entry.consignmentNo, marka: entry.marka,
      total_ctn: entry.totalCTN, cbm: entry.cbm, gw: entry.gw, destination: entry.destination,
      status: entry.status, client: entry.client, remarks: entry.remarks,
      lot_no: entry.lotNo, dispatched_from: entry.dispatchedFrom, container: entry.container,
      arrival_date_nylam: entry.arrivalDateNylam,
      arrival_at_lhasa: entry.arrivalAtLhasa || '',
      lhasa_container: entry.lhasaContainer || '',
      dispatched_from_lhasa: entry.dispatchedFromLhasa || '',
      lhasa: (entry.lhasa || []) as any,
      kerung: entry.kerung as any,
      tatopani: entry.tatopani as any, follow_up: entry.followUp, origin,
      created_by: email, updated_by: email,
    }).select().single();
    if (data) {
      const newEntry = mapLoadingFromDb(data);
      if (origin === 'guangzhou') {
        set((s) => ({ loadingListGuangzhou: [...s.loadingListGuangzhou, newEntry] }));
      } else {
        set((s) => ({ loadingListYiwu: [...s.loadingListYiwu, newEntry] }));
      }
      // sync to consignments
      const exists = get().consignments.find((c) => c.consignmentNo === newEntry.consignmentNo);
      if (!exists) {
        get().addConsignment({
          date: newEntry.date, consignmentNo: newEntry.consignmentNo, marka: newEntry.marka,
          totalCTN: newEntry.totalCTN, cbm: newEntry.cbm, gw: newEntry.gw, destination: newEntry.destination,
          status: newEntry.status, client: newEntry.client, remarks: newEntry.remarks, createdBy: '', updatedBy: '', updatedAt: '',
        });
      }
    }
  },

  updateLoadingListEntry: async (id, origin, updates) => {
    const email = await getCurrentUserEmail();
    const dbUpdates: any = { updated_by: email };
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.consignmentNo !== undefined) dbUpdates.consignment_no = updates.consignmentNo;
    if (updates.marka !== undefined) dbUpdates.marka = updates.marka;
    if (updates.totalCTN !== undefined) dbUpdates.total_ctn = updates.totalCTN;
    if (updates.cbm !== undefined) dbUpdates.cbm = updates.cbm;
    if (updates.gw !== undefined) dbUpdates.gw = updates.gw;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.client !== undefined) dbUpdates.client = updates.client;
    if (updates.remarks !== undefined) dbUpdates.remarks = updates.remarks;
    if (updates.lotNo !== undefined) dbUpdates.lot_no = updates.lotNo;
    if (updates.dispatchedFrom !== undefined) dbUpdates.dispatched_from = updates.dispatchedFrom;
    if (updates.container !== undefined) dbUpdates.container = updates.container;
    if (updates.arrivalDateNylam !== undefined) dbUpdates.arrival_date_nylam = updates.arrivalDateNylam;
    if (updates.arrivalAtLhasa !== undefined) dbUpdates.arrival_at_lhasa = updates.arrivalAtLhasa;
    if (updates.lhasaContainer !== undefined) dbUpdates.lhasa_container = updates.lhasaContainer;
    if (updates.dispatchedFromLhasa !== undefined) dbUpdates.dispatched_from_lhasa = updates.dispatchedFromLhasa;
    if ((updates as any).lhasa !== undefined) dbUpdates.lhasa = (updates as any).lhasa;
    if (updates.kerung !== undefined) dbUpdates.kerung = updates.kerung;
    if (updates.tatopani !== undefined) dbUpdates.tatopani = updates.tatopani;
    if (updates.followUp !== undefined) dbUpdates.follow_up = updates.followUp;
    if ((updates as any).remainingCTNLhasa !== undefined) dbUpdates.remaining_ctn_lhasa = (updates as any).remainingCTNLhasa;
    if ((updates as any).loadedCTNS !== undefined) dbUpdates.loaded_ctns = (updates as any).loadedCTNS;
    if ((updates as any).receivedCTNLhasa !== undefined) dbUpdates.received_ctn_lhasa = (updates as any).receivedCTNLhasa;
    if ((updates as any).receivedCTNNylam !== undefined) dbUpdates.received_ctn_nylam = (updates as any).receivedCTNNylam;
    await db.from('loading_list_entries').update(dbUpdates).eq('id', id);
    const key = origin === 'guangzhou' ? 'loadingListGuangzhou' : 'loadingListYiwu';
    set((s) => ({
      [key]: (s[key] as LoadingListEntry[]).map((e) => (e.id === id ? { ...e, ...updates } : e)),
    } as any));
    // Sync shared fields back to consignments
    const sharedFields = ['date', 'marka', 'totalCTN', 'cbm', 'gw', 'destination', 'status', 'client', 'remarks'];
    const hasSharedUpdate = sharedFields.some(f => (updates as any)[f] !== undefined);
    if (hasSharedUpdate) {
      const entry = (get()[key] as LoadingListEntry[]).find(e => e.id === id);
      if (entry) {
        const consignment = get().consignments.find(c => c.consignmentNo === entry.consignmentNo);
        if (consignment) {
          const consUpdates: any = {};
          sharedFields.forEach(f => { if ((updates as any)[f] !== undefined) consUpdates[f] = (updates as any)[f]; });
          const dbConsUpdates: any = {};
          if (consUpdates.date !== undefined) dbConsUpdates.date = consUpdates.date;
          if (consUpdates.marka !== undefined) dbConsUpdates.marka = consUpdates.marka;
          if (consUpdates.totalCTN !== undefined) dbConsUpdates.total_ctn = consUpdates.totalCTN;
          if (consUpdates.cbm !== undefined) dbConsUpdates.cbm = consUpdates.cbm;
          if (consUpdates.gw !== undefined) dbConsUpdates.gw = consUpdates.gw;
          if (consUpdates.destination !== undefined) dbConsUpdates.destination = consUpdates.destination;
          if (consUpdates.status !== undefined) dbConsUpdates.status = consUpdates.status;
          if (consUpdates.client !== undefined) dbConsUpdates.client = consUpdates.client;
          if (consUpdates.remarks !== undefined) dbConsUpdates.remarks = consUpdates.remarks;
          await db.from('consignments').update(dbConsUpdates).eq('id', consignment.id);
          set((s) => ({
            consignments: s.consignments.map(c => c.id === consignment.id ? { ...c, ...consUpdates } : c),
          }));
        }
      }
    }
  },

  deleteLoadingListEntry: async (id, origin) => {
    await db.from('loading_list_entries').delete().eq('id', id);
    const key = origin === 'guangzhou' ? 'loadingListGuangzhou' : 'loadingListYiwu';
    set((s) => ({
      [key]: (s[key] as LoadingListEntry[]).filter((e) => e.id !== id),
    } as any));
  },

  setLoadingList: (origin, entries) => {
    if (origin === 'guangzhou') set({ loadingListGuangzhou: entries });
    else set({ loadingListYiwu: entries });
  },

  addOldNylamEntry: async (entry) => {
    const { data } = await db.from('old_nylam_goods').insert({
      date: entry.date, consignment_no: entry.consignmentNo, marka: entry.marka,
      total_ctn: entry.totalCTN, ctn_remaining_nylam: entry.ctnRemainingNylam,
      loaded_ctn: entry.loadedCTN, cbm: entry.cbm, gw: entry.gw, destination: entry.destination,
      dispatched_from_nylam: entry.dispatchedFromNylam, nylam_container: entry.nylamContainer,
      arrival_location: entry.arrivalLocation, arrival_date: entry.arrivalDate,
      client: entry.client, follow_up: entry.followUp,
    }).select().single();
    if (data) set((s) => ({ oldNylamGoods: [...s.oldNylamGoods, mapOldNylamFromDb(data)] }));
  },

  updateOldNylamEntry: async (id, updates) => {
    const dbUpdates: any = {};
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.consignmentNo !== undefined) dbUpdates.consignment_no = updates.consignmentNo;
    if (updates.marka !== undefined) dbUpdates.marka = updates.marka;
    if (updates.totalCTN !== undefined) dbUpdates.total_ctn = updates.totalCTN;
    if (updates.ctnRemainingNylam !== undefined) dbUpdates.ctn_remaining_nylam = updates.ctnRemainingNylam;
    if (updates.loadedCTN !== undefined) dbUpdates.loaded_ctn = updates.loadedCTN;
    if (updates.cbm !== undefined) dbUpdates.cbm = updates.cbm;
    if (updates.gw !== undefined) dbUpdates.gw = updates.gw;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.dispatchedFromNylam !== undefined) dbUpdates.dispatched_from_nylam = updates.dispatchedFromNylam;
    if (updates.nylamContainer !== undefined) dbUpdates.nylam_container = updates.nylamContainer;
    if (updates.arrivalLocation !== undefined) dbUpdates.arrival_location = updates.arrivalLocation;
    if (updates.arrivalDate !== undefined) dbUpdates.arrival_date = updates.arrivalDate;
    if (updates.client !== undefined) dbUpdates.client = updates.client;
    if (updates.followUp !== undefined) dbUpdates.follow_up = updates.followUp;
    await db.from('old_nylam_goods').update(dbUpdates).eq('id', id);
    set((s) => ({ oldNylamGoods: s.oldNylamGoods.map((e) => (e.id === id ? { ...e, ...updates } : e)) }));
  },

  deleteOldNylamEntry: async (id) => {
    await db.from('old_nylam_goods').delete().eq('id', id);
    set((s) => ({ oldNylamGoods: s.oldNylamGoods.filter((e) => e.id !== id) }));
  },

  addRemainingCTN: async (entry) => {
    const email = await getCurrentUserEmail();
    const { data } = await db.from('remaining_ctns').insert({
      date: entry.date, consignment_no: entry.consignmentNo, marka: entry.marka,
      total_ctn: entry.totalCTN, cbm: entry.cbm, gw: entry.gw, destination: entry.destination,
      remaining_ctn: entry.remainingCTN, remaining_ctn_location: entry.remainingCTNLocation,
      client: entry.client, created_by: email, updated_by: email,
    }).select().single();
    if (data) set((s) => ({ remainingCTNs: [...s.remainingCTNs, mapRemainingFromDb(data)] }));
  },

  updateRemainingCTN: async (id, updates) => {
    const email = await getCurrentUserEmail();
    const dbUpdates: any = { updated_by: email };
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.consignmentNo !== undefined) dbUpdates.consignment_no = updates.consignmentNo;
    if (updates.marka !== undefined) dbUpdates.marka = updates.marka;
    if (updates.totalCTN !== undefined) dbUpdates.total_ctn = updates.totalCTN;
    if (updates.cbm !== undefined) dbUpdates.cbm = updates.cbm;
    if (updates.gw !== undefined) dbUpdates.gw = updates.gw;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.remainingCTN !== undefined) dbUpdates.remaining_ctn = updates.remainingCTN;
    if (updates.remainingCTNLocation !== undefined) dbUpdates.remaining_ctn_location = updates.remainingCTNLocation;
    if (updates.client !== undefined) dbUpdates.client = updates.client;
    await db.from('remaining_ctns').update(dbUpdates).eq('id', id);
    set((s) => ({ remainingCTNs: s.remainingCTNs.map((e) => (e.id === id ? { ...e, ...updates, updatedBy: email } : e)) }));
  },

  deleteRemainingCTN: async (id) => {
    await db.from('remaining_ctns').delete().eq('id', id);
    set((s) => ({ remainingCTNs: s.remainingCTNs.filter((e) => e.id !== id) }));
  },

  syncConsignmentToLoadingList: (c) => {
    const no = c.consignmentNo.toUpperCase();
    let origin: 'guangzhou' | 'yiwu' | null = null;
    if (no.startsWith('YA') || no.startsWith('YW')) origin = 'yiwu';
    else if (no.startsWith('GA') || no.startsWith('GW')) origin = 'guangzhou';
    if (!origin) return;

    const list = origin === 'yiwu' ? get().loadingListYiwu : get().loadingListGuangzhou;
    const exists = list.find((e) => e.consignmentNo === c.consignmentNo);
    if (!exists) {
      get().addLoadingListEntry({
        date: c.date, consignmentNo: c.consignmentNo, marka: c.marka,
        totalCTN: c.totalCTN, cbm: c.cbm, gw: c.gw, destination: c.destination,
        status: c.status, client: c.client, remarks: c.remarks,
        lotNo: '', dispatchedFrom: '', container: '', arrivalDateNylam: '',
        arrivalAtLhasa: '', lhasaContainer: '', dispatchedFromLhasa: '',
        lhasa: [],
        kerung: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
        tatopani: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
        followUp: false, origin, createdBy: '', updatedBy: '', updatedAt: '',
      }, origin);
    }
  },
}));
