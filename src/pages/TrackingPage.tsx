import React, { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { getStatusClass, getDestinationClass } from '@/types';

export default function TrackingPage() {
  const { consignments, loadingListGuangzhou, loadingListYiwu, remainingCTNs } = useStore();
  const [search, setSearch] = useState('');
  const allLoading = [...loadingListGuangzhou, ...loadingListYiwu];

  const results = useMemo(() => {
    if (!search.trim()) return null;
    const s = search.toLowerCase();
    const matchedLoading = allLoading.filter(e =>
      e.consignmentNo.toLowerCase().includes(s) || e.marka.toLowerCase().includes(s) || e.container.toLowerCase().includes(s) || e.client.toLowerCase().includes(s)
    );
    const matchedConsignments = consignments.filter(c =>
      c.consignmentNo.toLowerCase().includes(s) || c.marka.toLowerCase().includes(s) || c.client.toLowerCase().includes(s)
    );
    const matchedRemaining = remainingCTNs.filter(e =>
      e.consignmentNo.toLowerCase().includes(s) || e.marka.toLowerCase().includes(s)
    );
    return { matchedConsignments, matchedLoading, matchedRemaining };
  }, [search, consignments, allLoading, remainingCTNs]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Tracking System</h2>
      <div className="relative max-w-lg mx-auto mb-6">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Search consignment, MARKA, container, client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 text-base" />
      </div>

      {results && (
        <div className="space-y-8 max-w-5xl mx-auto">
          {results.matchedLoading.length > 0 && (
            <>
              <h3 className="font-bold text-lg flex items-center gap-2">📦 Consignment Details ({results.matchedLoading.length})</h3>
              {results.matchedLoading.map(e => {
                const totalLoadedTatopani = e.tatopani.reduce((s, t) => s + (t.loadedCTN || 0), 0);
                const totalLoadedKerung = e.kerung.reduce((s, k) => s + (k.loadedCTN || 0), 0);
                const originLabel = e.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu';
                const tatopaniWithData = e.tatopani.filter(t => t.dispatchedFromNylam || t.loadedCTN || t.nylamContainer);
                const kerungWithData = e.kerung.filter(k => k.dispatchedFromNylam || k.loadedCTN || k.nylamContainer);
                const hasArrivedNylam = !!e.arrivalDateNylam;

                let onTheWay = 0;
                let hasOnTheWay = false;
                e.tatopani.forEach(t => { if (t.status === 'On the way to Tatopani' && t.loadedCTN) { onTheWay += t.loadedCTN; hasOnTheWay = true; } });
                e.kerung.forEach(k => { if (k.status === 'On the way to Kerung' && k.loadedCTN) { onTheWay += k.loadedCTN; hasOnTheWay = true; } });

                let missingCTN = 0;
                let hasMissing = false;
                e.tatopani.forEach(t => {
                  if (t.receivedCTN != null && t.loadedCTN && !t.status?.includes('On the way')) {
                    missingCTN += (t.loadedCTN - t.receivedCTN);
                    hasMissing = true;
                  }
                });
                e.kerung.forEach(k => {
                  if (k.receivedCTN != null && k.loadedCTN && !k.status?.includes('On the way')) {
                    missingCTN += (k.loadedCTN - k.receivedCTN);
                    hasMissing = true;
                  }
                });

                let totalLoaded = totalLoadedTatopani + totalLoadedKerung;
                let remainingAtNylam = e.totalCTN - totalLoaded;
                let hasRemaining = totalLoaded > 0 && remainingAtNylam > 0;

                const lhasaEntries = e.lhasa || [];
                const hasLhasaInfo = lhasaEntries.length > 0 || !!(e.arrivalAtLhasa);
                const hasRemainingLhasa = e.remainingCTNLhasa != null;

                return (
                  <div key={e.id} className="border rounded-lg bg-card overflow-hidden">
                    {/* Header */}
                    <div className="border-b p-4 bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-muted-foreground text-xs">Consignment No.</span><div className="font-bold">{e.consignmentNo}</div></div>
                        <div><span className="text-muted-foreground text-xs">MARKA</span><div className="font-bold">{e.marka}</div></div>
                        <div><span className="text-muted-foreground text-xs">Total CTN</span><div className="font-bold text-primary">{e.totalCTN}</div></div>
                        <div><span className="text-muted-foreground text-xs">Destination</span><div className={`font-bold ${getDestinationClass(e.destination)}`}>{e.destination}</div></div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                        <div className="bg-primary/5 rounded p-2 border border-primary/20"><span className="text-muted-foreground text-xs">Client</span><div className="font-bold text-primary">{e.client || '-'}</div></div>
                        <div><span className="text-muted-foreground text-xs">Date</span><div className="font-semibold">{e.date}</div></div>
                        <div><span className="text-muted-foreground text-xs">CBM</span><div className="font-semibold">{e.cbm}</div></div>
                        <div><span className="text-muted-foreground text-xs">GW</span><div className="font-semibold">{e.gw}</div></div>
                      </div>
                      {e.remarks && (
                        <div className="mt-3 bg-warning/10 rounded p-2 border border-warning/30">
                          <span className="text-muted-foreground text-xs">📝 Remarks</span>
                          <div className="font-semibold text-sm">{e.remarks}</div>
                        </div>
                      )}
                    </div>

                    {/* Shipment Trail */}
                    <div className="p-4 border-b">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-sm flex items-center gap-2">⊙ Shipment Trail</h4>
                        <span className={`status-badge text-lg px-6 py-1.5 font-extrabold ${getStatusClass(e.status)}`}>{e.status || 'No Status'}</span>
                      </div>

                      {/* Trail header with consignment info */}
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-bold mb-1">{e.consignmentNo} • {e.marka}</div>
                        <div className="text-xs text-muted-foreground mb-3">{originLabel} → {e.destination}</div>

                        {/* Trail cards - horizontal scroll */}
                        <div className="flex items-start gap-2 overflow-x-auto pb-2">
                          {/* Origin dispatch card */}
                          <div className="min-w-[180px] border rounded-lg p-3 bg-green-50 text-center flex-shrink-0">
                            <div className="text-xs font-bold text-green-700 mb-1">Dispatched from {originLabel}</div>
                            <div className="text-base font-bold px-3 py-1 rounded-md inline-block bg-green-100 text-green-800">✓ Done</div>
                            {e.dispatchedFrom && <div className="text-xs text-muted-foreground mt-1">📅 {e.dispatchedFrom}</div>}
                            {e.container && <div className="text-xs text-muted-foreground">Container: {e.container}</div>}
                          </div>

                          <span className="mt-8 text-muted-foreground text-lg font-bold flex-shrink-0">→</span>

                          {/* Lhasa - one card per Lhasa-Nylam container, only if filled */}
                          {hasLhasaInfo && lhasaEntries.length === 0 && (
                            <>
                              <div className="min-w-[180px] border rounded-lg p-3 bg-purple-50 text-center flex-shrink-0">
                                <div className="text-xs font-bold text-purple-700 mb-1">Lhasa</div>
                                <div className={`text-base font-bold px-3 py-1 rounded-md inline-block ${e.arrivalAtLhasa ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'}`}>{e.arrivalAtLhasa ? '✓ Arrived' : '⏳ In Transit'}</div>
                                {e.arrivalAtLhasa && <div className="text-xs text-muted-foreground mt-1">📅 {e.arrivalAtLhasa}</div>}
                              </div>
                              <span className="mt-8 text-muted-foreground text-lg font-bold flex-shrink-0">→</span>
                            </>
                          )}
                          {lhasaEntries.map((l, i) => (
                            <React.Fragment key={`l-${i}`}>
                              <div className="min-w-[200px] border rounded-lg p-3 bg-purple-50 text-center flex-shrink-0">
                                <div className="text-xs font-bold text-purple-700 mb-1">Lhasa Container {i + 1}</div>
                                <div className={`text-base font-bold px-3 py-1 rounded-md inline-block ${e.arrivalAtLhasa ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'}`}>{e.arrivalAtLhasa ? '✓ Arrived' : '⏳ In Transit'}</div>
                                {e.arrivalAtLhasa && <div className="text-xs text-muted-foreground mt-1">📅 Arrived: {e.arrivalAtLhasa}</div>}
                                {l.nylamContainer && <div className="text-xs text-muted-foreground">Container: {l.nylamContainer}</div>}
                                {l.dispatchedFromLhasa && <div className="text-xs text-muted-foreground">Dispatched: {l.dispatchedFromLhasa}</div>}
                                {l.loadedCTN != null && <div className="text-xs text-muted-foreground">Loaded: {l.loadedCTN} CTN</div>}
                              </div>
                              <span className="mt-8 text-muted-foreground text-lg font-bold flex-shrink-0">→</span>
                            </React.Fragment>
                          ))}

                          {/* Nylam — received = sum of Lhasa Loaded CTN if present, else totalCTN */}
                          {(() => {
                            const totalLhasaLoaded = lhasaEntries.reduce((s, l) => s + (l.loadedCTN || 0), 0);
                            const receivedAtNylam = totalLhasaLoaded > 0 ? totalLhasaLoaded : e.totalCTN;
                            return (
                              <div className={`min-w-[180px] border rounded-lg p-3 text-center flex-shrink-0 ${hasArrivedNylam ? 'bg-primary/5' : 'bg-yellow-50'}`}>
                                <div className={`text-xs font-bold mb-1 ${hasArrivedNylam ? 'text-primary' : 'text-yellow-700'}`}>At Nylam</div>
                                <div className={`text-base font-bold px-3 py-1 rounded-md inline-block ${hasArrivedNylam ? 'bg-primary/15 text-primary' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {hasArrivedNylam ? `Received ${receivedAtNylam} CTN` : '⏳ Pending'}
                                </div>
                                {e.arrivalDateNylam && <div className="text-xs text-muted-foreground mt-1">📅 {e.arrivalDateNylam}</div>}
                              </div>
                            );
                          })()}

                          {/* Tatopani containers */}
                          {tatopaniWithData.map((t, i) => (
                            <React.Fragment key={`t-${i}`}>
                              <span className="mt-8 text-muted-foreground text-lg font-bold flex-shrink-0">→</span>
                              <div className="min-w-[200px] border rounded-lg p-3 bg-orange-50 text-center flex-shrink-0">
                                <div className="text-xs font-bold text-orange-700 mb-1">Tatopani Container {i + 1}</div>
                                <div className={`text-base font-bold px-3 py-1 rounded-md inline-block ${getStatusClass(t.status)} !text-sm`}>{t.status || '—'}</div>
                                {t.arrivalDate && <div className="text-xs text-muted-foreground mt-1">📅 {t.arrivalDate}</div>}
                                {t.nylamContainer && <div className="text-xs text-muted-foreground">{t.nylamContainer} | Loaded: {t.loadedCTN ?? '-'} | Received: {t.receivedCTN ?? '-'}</div>}
                              </div>
                            </React.Fragment>
                          ))}

                          {/* Kerung containers */}
                          {kerungWithData.map((k, i) => (
                            <React.Fragment key={`k-${i}`}>
                              <span className="mt-8 text-muted-foreground text-lg font-bold flex-shrink-0">→</span>
                              <div className="min-w-[200px] border rounded-lg p-3 bg-destructive/5 text-center flex-shrink-0">
                                <div className="text-xs font-bold text-destructive mb-1">Kerung Container {i + 1}</div>
                                <div className={`text-base font-bold px-3 py-1 rounded-md inline-block ${getStatusClass(k.status)} !text-sm`}>{k.status || '—'}</div>
                                {k.arrivalDate && <div className="text-xs text-muted-foreground mt-1">📅 {k.arrivalDate}</div>}
                                {k.nylamContainer && <div className="text-xs text-muted-foreground">{k.nylamContainer} | Loaded: {k.loadedCTN ?? '-'} | Received: {k.receivedCTN ?? '-'}</div>}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Lhasa details - only if filled */}
                    {(hasLhasaInfo || hasRemainingLhasa) && (
                      <div className="p-4 border-b">
                        <h4 className="font-bold text-sm mb-2 text-purple-700">🏔️ LHASA Details</h4>
                        <div className="border rounded p-3 text-sm">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                            {e.arrivalAtLhasa && <><div className="text-muted-foreground">Arrival at Lhasa:</div><div className="text-right font-semibold">{e.arrivalAtLhasa}</div></>}
                            {hasRemainingLhasa && <><div className="text-muted-foreground">Remaining CTN at Lhasa:</div><div className="text-right font-semibold">{e.remainingCTNLhasa}</div></>}
                          </div>
                          {lhasaEntries.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {lhasaEntries.map((l, i) => (
                                <div key={i} className="border rounded p-2 bg-purple-50/40 grid grid-cols-3 gap-x-4 text-xs">
                                  <div><span className="font-bold">Container {i + 1}:</span> {l.nylamContainer || '-'}</div>
                                  <div><span className="font-bold">Dispatched:</span> {l.dispatchedFromLhasa || '-'}</div>
                                  <div><span className="font-bold">Loaded CTN:</span> {l.loadedCTN ?? '-'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TATOPANI detail table */}
                    {tatopaniWithData.length > 0 && (
                      <div className="p-4 border-b">
                        <h4 className="font-bold text-sm mb-2">🏔️ TATOPANI ({tatopaniWithData.length} containers)</h4>
                        {tatopaniWithData.map((t, i) => (
                          <div key={i} className="border rounded p-3 mb-2 text-sm">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                              <div className="text-muted-foreground">Container:</div><div className="text-right font-semibold">{t.nylamContainer || '-'}</div>
                              <div className="text-muted-foreground">Dispatched:</div><div className="text-right font-semibold">{t.dispatchedFromNylam || '-'}</div>
                              <div className="text-muted-foreground">Loaded CTN:</div><div className="text-right font-semibold">{t.loadedCTN ?? '-'}</div>
                              <div className="text-muted-foreground">Received CTN:</div><div className="text-right font-semibold">{hasArrivedNylam ? (t.receivedCTN ?? '-') : 'Pending'}</div>
                              <div className="text-muted-foreground">Status:</div><div className="text-right"><span className={`${getStatusClass(t.status)}`}>{t.status || '-'}</span></div>
                              <div className="text-muted-foreground">Arrival Date at Tatopani:</div><div className="text-right font-semibold">📅 {t.arrivalDate || '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* KERUNG detail table */}
                    {kerungWithData.length > 0 && (
                      <div className="p-4 border-b">
                        <h4 className="font-bold text-sm mb-2 text-destructive">🔴 KERUNG ({kerungWithData.length} containers)</h4>
                        {kerungWithData.map((k, i) => (
                          <div key={i} className="border rounded p-3 mb-2 text-sm">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                              <div className="text-muted-foreground">Container:</div><div className="text-right font-semibold">{k.nylamContainer || '-'}</div>
                              <div className="text-muted-foreground">Dispatched:</div><div className="text-right font-semibold">{k.dispatchedFromNylam || '-'}</div>
                              <div className="text-muted-foreground">Loaded CTN:</div><div className="text-right font-semibold">{k.loadedCTN ?? '-'}</div>
                              <div className="text-muted-foreground">Received CTN:</div><div className="text-right font-semibold">{hasArrivedNylam ? (k.receivedCTN ?? '-') : 'Pending'}</div>
                              <div className="text-muted-foreground">Status:</div><div className="text-right"><span className={`${getStatusClass(k.status)}`}>{k.status || '-'}</span></div>
                              <div className="text-muted-foreground">Arrival Date at Kerung:</div><div className="text-right font-semibold">📅 {k.arrivalDate || '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t bg-muted/30">
                      <div className="p-3 border-r"><span className="text-xs text-muted-foreground block">Total CTN</span><span className="font-bold">{e.totalCTN}</span></div>
                      <div className="p-3 border-r"><span className="text-xs text-muted-foreground block">Received at Nylam</span><span className="font-bold">{hasArrivedNylam ? e.totalCTN : 'Pending'}</span></div>
                      <div className="p-3 border-r"><span className="text-xs text-muted-foreground block">Loaded Tatopani</span><span className="font-bold">{totalLoadedTatopani || '—'}</span></div>
                      <div className="p-3"><span className="text-xs text-muted-foreground block">Loaded Kerung</span><span className="font-bold">{totalLoadedKerung || '—'}</span></div>
                    </div>

                    {(hasOnTheWay || (hasMissing && missingCTN > 0) || hasRemaining) && (
                      <div className="border-t">
                        {hasOnTheWay && (
                          <div className="text-sm p-3 bg-blue-50 text-blue-700 font-medium">🚚 On The Way: {onTheWay}</div>
                        )}
                        {hasMissing && missingCTN > 0 && (
                          <div className="text-sm p-3 bg-destructive/10 text-destructive font-medium">⚠ Missing CTN: {missingCTN}</div>
                        )}
                        {hasRemaining && (
                          <div className="text-sm p-3 bg-orange-50 text-orange-700 font-medium">⏳ Remaining at Nylam: {remainingAtNylam}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {results.matchedLoading.length === 0 && results.matchedConsignments.length > 0 && (
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="font-bold mb-2">Consignment Records</h3>
              {results.matchedConsignments.map(c => (
                <div key={c.id} className="grid grid-cols-3 gap-2 text-sm border-b py-2">
                  <div><span className="font-bold">No.:</span> {c.consignmentNo}</div>
                  <div><span className="font-bold">MARKA:</span> {c.marka}</div>
                  <div><span className="font-bold">Status:</span> <span className={`status-badge ${getStatusClass(c.status)}`}>{c.status || '-'}</span></div>
                </div>
              ))}
            </div>
          )}

          {results.matchedLoading.length === 0 && results.matchedConsignments.length === 0 && (
            <div className="text-center text-muted-foreground py-8">No results found for "{search}"</div>
          )}
        </div>
      )}

      {!results && (
        <div className="text-center text-muted-foreground py-16">
          <p className="text-lg">Enter a search term to track consignments</p>
          <p className="text-sm mt-1">Search by Consignment No., MARKA, Container No., or Client</p>
        </div>
      )}
    </div>
  );
}
