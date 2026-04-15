import React, { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Eye, Users, Package, TrendingUp, MapPin, BarChart3, List, AlertTriangle, Navigation } from 'lucide-react';
import { getStatusClass, getDestinationClass } from '@/types';
import type { LoadingListEntry } from '@/types';

function MiniPieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-sm text-muted-foreground text-center py-4 font-bold">No data</div>;
  let cumulative = 0;
  const slices = data.filter(d => d.value > 0).map(d => {
    const start = cumulative / total;
    cumulative += d.value;
    const end = cumulative / total;
    return { ...d, start, end };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {slices.map((s, i) => {
          const startAngle = s.start * 360 - 90;
          const endAngle = s.end * 360 - 90;
          const largeArc = s.end - s.start > 0.5 ? 1 : 0;
          const x1 = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
          const y1 = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
          const x2 = 50 + 45 * Math.cos((endAngle * Math.PI) / 180);
          const y2 = 50 + 45 * Math.sin((endAngle * Math.PI) / 180);
          return <path key={i} d={`M50,50 L${x1},${y1} A45,45 0 ${largeArc},1 ${x2},${y2} Z`} fill={s.color} stroke="white" strokeWidth="1" />;
        })}
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="font-bold">{s.label}: {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-sm font-bold w-20 truncate text-right">{d.label}</span>
          <div className="flex-1 bg-muted rounded h-5 overflow-hidden">
            <div className="h-full rounded transition-all" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
          <span className="text-sm font-bold w-8">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { consignments, loadingListGuangzhou, loadingListYiwu } = useStore();
  const allLoading = [...loadingListGuangzhou, ...loadingListYiwu];
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  // Build clients list - use "Unknown" for empty client names
  const clients = useMemo(() => {
    const set = new Set<string>();
    consignments.forEach(c => { set.add(c.client || 'Unknown'); });
    allLoading.forEach(e => { set.add(e.client || 'Unknown'); });
    return Array.from(set).sort();
  }, [consignments, allLoading]);

  const filteredClients = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    const matchedClients = new Set<string>();
    consignments.forEach(c => {
      if (c.consignmentNo.toLowerCase().includes(s) || (c.marka && c.marka.toLowerCase().includes(s))) {
        matchedClients.add(c.client || 'Unknown');
      }
    });
    const nameMatched = clients.filter(c => c.toLowerCase().includes(s));
    const combined = new Set([...nameMatched, ...matchedClients]);
    return Array.from(combined).sort();
  }, [clients, search, consignments]);

  const clientConsignmentsFiltered = useMemo(() => {
    if (!selectedClient) return [];
    const clientCons = consignments.filter(c => (c.client || 'Unknown') === selectedClient);
    if (!search) return clientCons;
    const s = search.toLowerCase();
    const hasMatch = consignments.some(c => c.consignmentNo.toLowerCase().includes(s) || (c.marka && c.marka.toLowerCase().includes(s)));
    if (hasMatch) {
      return clientCons.filter(c => c.consignmentNo.toLowerCase().includes(s) || (c.marka && c.marka.toLowerCase().includes(s)));
    }
    return clientCons;
  }, [selectedClient, consignments, search]);

  const viewLoadingEntry: LoadingListEntry | undefined = viewId ? allLoading.find(e => e.consignmentNo === consignments.find(c => c.id === viewId)?.consignmentNo) : undefined;

  const totalConsignments = consignments.length;
  const totalClients = clients.length;
  const guangzhouCount = loadingListGuangzhou.length;
  const yiwuCount = loadingListYiwu.length;
  const onWayCount = consignments.filter(c => c.status.includes('way')).length;
  const atNylamCount = consignments.filter(c => c.status === 'At Nylam').length;
  const atDestCount = consignments.filter(c => c.status.includes('At Tatopani') || c.status.includes('At Kerung')).length;
  const remainingCTNs = allLoading.reduce((sum, e) => sum + (e.remainingCTNNylam || 0), 0);

  const destCounts = useMemo(() => {
    const map: Record<string, number> = {};
    consignments.forEach(c => { map[c.destination] = (map[c.destination] || 0) + 1; });
    return map;
  }, [consignments]);

  const destChartData = [
    { label: 'TATOPANI', value: destCounts['TATOPANI'] || 0, color: '#f97316' },
    { label: 'KERUNG', value: destCounts['KERUNG'] || 0, color: '#ef4444' },
    { label: 'TATOPANI-KERUNG', value: destCounts['TATOPANI - KERUNG'] || 0, color: '#8b5cf6' },
    { label: 'KERUNG-TATOPANI', value: destCounts['KERUNG - TATOPANI'] || 0, color: '#06b6d4' },
    { label: 'NYLAM', value: destCounts['NYLAM'] || 0, color: '#22c55e' },
  ];

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    consignments.forEach(c => { if (c.status) map[c.status] = (map[c.status] || 0) + 1; });
    return map;
  }, [consignments]);

  const statusChartData = Object.entries(statusCounts).map(([label, value], i) => ({
    label, value,
    color: ['#3b82f6', '#f97316', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4', '#eab308', '#ec4899'][i % 8],
  }));

  const topClients = useMemo(() => {
    const map: Record<string, number> = {};
    consignments.forEach(c => { const cl = c.client || 'Unknown'; map[cl] = (map[cl] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value], i) => ({
      label, value,
      color: ['#3b82f6', '#f97316', '#22c55e', '#8b5cf6', '#06b6d4', '#ef4444'][i % 6],
    }));
  }, [consignments]);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Dashboard</h2>
        <p className="text-sm font-bold text-muted-foreground">ADO International Transport Company - Overview</p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">Total Consignments</span><Package className="h-5 w-5 text-primary" /></div>
          <p className="text-3xl font-bold">{totalConsignments}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">Guangzhou Shipments</span><List className="h-5 w-5 text-primary" /></div>
          <p className="text-3xl font-bold">{guangzhouCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">Yiwu Shipments</span><List className="h-5 w-5 text-primary" /></div>
          <p className="text-3xl font-bold">{yiwuCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">On The Way</span><TrendingUp className="h-5 w-5 text-destructive" /></div>
          <p className="text-3xl font-bold">{onWayCount}</p>
        </div>
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">At Nylam</span><MapPin className="h-5 w-5 text-primary" /></div>
          <p className="text-3xl font-bold">{atNylamCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">At Destination</span><Navigation className="h-5 w-5 text-primary" /></div>
          <p className="text-3xl font-bold">{atDestCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">Remaining CTNs</span><AlertTriangle className="h-5 w-5 text-destructive" /></div>
          <p className="text-3xl font-bold">{remainingCTNs}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-muted-foreground">Clients</span><Users className="h-5 w-5 text-primary" /></div>
          <p className="text-3xl font-bold">{totalClients}</p>
        </div>
      </div>

      {/* Client List - MOVED ABOVE CHARTS */}
      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col items-center mb-3">
          <h3 className="font-bold text-lg mb-2">Clients</h3>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search client, consignment no, or MARKA..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        {filteredClients.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center font-bold">No clients found.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {filteredClients.map(client => (
              <button key={client} onClick={() => setSelectedClient(client)} className="text-left p-3 border rounded-lg hover:bg-accent hover:shadow-sm transition-all">
                <div className="font-bold">{client}</div>
                <div className="text-xs font-bold text-muted-foreground">{consignments.filter(c => (c.client || 'Unknown') === client).length} consignments</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Charts Row - MOVED BELOW CLIENTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Destination Distribution</h3>
          <MiniPieChart data={destChartData} />
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Status Overview</h3>
          <MiniBarChart data={statusChartData} />
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Top Clients</h3>
          <MiniBarChart data={topClients} />
        </div>
      </div>

      {/* Client Consignments Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-bold">Client: {selectedClient}</DialogTitle></DialogHeader>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left font-bold">Date</th>
                  <th className="p-2 text-left font-bold">Consignment No.</th>
                  <th className="p-2 text-left font-bold">MARKA</th>
                  <th className="p-2 text-left font-bold">Total CTN</th>
                  <th className="p-2 text-left font-bold">CBM</th>
                  <th className="p-2 text-left font-bold">GW</th>
                  <th className="p-2 text-left font-bold">Destination</th>
                  <th className="p-2 text-left font-bold">Status</th>
                  <th className="p-2 text-left font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientConsignmentsFiltered.map(c => (
                  <tr key={c.id} className={`border-b hover:bg-accent/50 ${getDestinationClass(c.destination) ? 'text-destructive' : ''}`}>
                    <td className="p-2 font-bold">{c.date}</td>
                    <td className="p-2 font-bold">{c.consignmentNo}</td>
                    <td className="p-2 font-bold">{c.marka}</td>
                    <td className="p-2 font-bold">{c.totalCTN}</td>
                    <td className="p-2 font-bold">{c.cbm}</td>
                    <td className="p-2 font-bold">{c.gw}</td>
                    <td className={`p-2 font-bold ${getDestinationClass(c.destination)}`}>{c.destination}</td>
                    <td className="p-2"><span className={`status-badge ${getStatusClass(c.status)}`}>{c.status || '-'}</span></td>
                    <td className="p-2"><button onClick={() => setViewId(c.id)} className="p-1 hover:bg-accent rounded"><Eye className="h-4 w-4 text-primary" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog - Full Loading List format */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-[800px] max-h-[90vh] p-0">
          {viewLoadingEntry ? (
            <>
              <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{viewLoadingEntry.consignmentNo}</h2>
                    <p className="text-sm font-bold opacity-90">{viewLoadingEntry.marka} • {viewLoadingEntry.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu'}</p>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <span className={`status-badge text-lg px-8 py-2 font-bold ${getStatusClass(viewLoadingEntry.status)}`}>{viewLoadingEntry.status || '-'}</span>
                </div>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📅 Date</span><span className="font-bold">{viewLoadingEntry.date}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Consignment No.</span><span className="font-bold text-lg">{viewLoadingEntry.consignmentNo}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">🏷️ MARKA</span><span className="font-bold text-lg">{viewLoadingEntry.marka}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Total CTN</span><span className="text-xl font-bold">{viewLoadingEntry.totalCTN}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📐 CBM</span><span className="font-bold">{viewLoadingEntry.cbm}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">⚖️ GW (KG)</span><span className="font-bold">{viewLoadingEntry.gw}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📍 Destination</span><span className={`font-bold ${getDestinationClass(viewLoadingEntry.destination)}`}>{viewLoadingEntry.destination}</span></div>
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📋 LOT No.</span><span className="font-bold">{viewLoadingEntry.lotNo || '-'}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">🚚 Dispatched</span><span className="font-bold">{viewLoadingEntry.dispatchedFrom || '-'}</span></div>
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">🚢 Container</span><span className="font-bold">{viewLoadingEntry.container || '-'}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📅 Arrival at Nylam</span><span className="font-bold">{viewLoadingEntry.arrivalDateNylam || '-'}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">👤 Client</span><span className="font-bold text-lg">{viewLoadingEntry.client || '-'}</span></div>
                  {viewLoadingEntry.arrivalAtLhasa && (
                    <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📅 Arrival at Lhasa</span><span className="font-bold">{viewLoadingEntry.arrivalAtLhasa}</span></div>
                  )}
                  {viewLoadingEntry.lhasaContainer && (
                    <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">🚢 Lhasa Container</span><span className="font-bold">{viewLoadingEntry.lhasaContainer}</span></div>
                  )}
                  {viewLoadingEntry.dispatchedFromLhasa && (
                    <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">🚚 Dispatched from Lhasa</span><span className="font-bold">{viewLoadingEntry.dispatchedFromLhasa}</span></div>
                  )}
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">✅ Follow Up</span><span className="font-bold">{viewLoadingEntry.followUp ? '✅ Done' : '⬜ Pending'}</span></div>
                  <div className="border rounded p-2 col-span-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📝 Remarks</span><span className="font-bold">{viewLoadingEntry.remarks || '-'}</span></div>
                </div>

                {/* TATOPANI & KERUNG side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3">
                    <h4 className="font-bold text-sm mb-2">🔶 TATOPANI ({viewLoadingEntry.tatopani.length} rows)</h4>
                    {viewLoadingEntry.tatopani.map((t, i) => (
                      <div key={i} className="border rounded p-2 bg-accent/20 grid grid-cols-3 gap-1.5 text-xs mb-1.5">
                        <div><span className="font-bold">Dispatched:</span> <span className="font-bold">{t.dispatchedFromNylam || '-'}</span></div>
                        <div><span className="font-bold">Loaded:</span> <span className="font-bold">{t.loadedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Container:</span> <span className="font-bold">{t.nylamContainer || '-'}</span></div>
                        <div><span className="font-bold">Status:</span> <span className={`font-bold ${getStatusClass(t.status)}`}>{t.status || '-'}</span></div>
                        <div><span className="font-bold">Received:</span> <span className="font-bold">{t.receivedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Arrival:</span> <span className="font-bold">{t.arrivalDate || '-'}</span></div>
                      </div>
                    ))}
                  </div>
                  <div className="border rounded-lg p-3">
                    <h4 className="font-bold text-sm mb-2 text-destructive">🔴 KERUNG ({viewLoadingEntry.kerung.length} rows)</h4>
                    {viewLoadingEntry.kerung.map((k, i) => (
                      <div key={i} className="border rounded p-2 bg-destructive/5 grid grid-cols-3 gap-1.5 text-xs mb-1.5">
                        <div><span className="font-bold">Dispatched:</span> <span className="font-bold">{k.dispatchedFromNylam || '-'}</span></div>
                        <div><span className="font-bold">Loaded:</span> <span className="font-bold">{k.loadedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Container:</span> <span className="font-bold">{k.nylamContainer || '-'}</span></div>
                        <div><span className="font-bold">Status:</span> <span className={`font-bold ${getStatusClass(k.status)}`}>{k.status || '-'}</span></div>
                        <div><span className="font-bold">Received:</span> <span className="font-bold">{k.receivedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Arrival:</span> <span className="font-bold">{k.arrivalDate || '-'}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : viewId && consignments.find(c => c.id === viewId) ? (
            <div className="p-4">
              <DialogHeader><DialogTitle className="font-bold">Consignment Details</DialogTitle></DialogHeader>
              {(() => {
                const vc = consignments.find(c => c.id === viewId)!;
                return (
                  <div className="grid grid-cols-3 gap-3 text-sm mt-4">
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Date</span><span className="font-bold">{vc.date}</span></div>
                    <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Consignment No.</span><span className="font-bold text-lg">{vc.consignmentNo}</span></div>
                    <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">MARKA</span><span className="font-bold text-lg">{vc.marka}</span></div>
                    <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Total CTN</span><span className="font-bold text-lg">{vc.totalCTN}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">CBM</span><span className="font-bold">{vc.cbm}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">GW</span><span className="font-bold">{vc.gw}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Destination</span><span className={`font-bold ${getDestinationClass(vc.destination)}`}>{vc.destination}</span></div>
                    <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Client</span><span className="font-bold text-lg">{vc.client}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Status</span><span className={`status-badge ${getStatusClass(vc.status)}`}>{vc.status || '-'}</span></div>
                    <div className="bg-accent/30 rounded p-3 col-span-3"><span className="font-bold block text-xs text-muted-foreground">Remarks</span><span className="font-bold">{vc.remarks || '-'}</span></div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
