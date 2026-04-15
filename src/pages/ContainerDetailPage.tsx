import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft } from 'lucide-react';
import { getStatusClass, getDestinationClass, STATUSES } from '@/types';
import type { ConsignmentStatus } from '@/types';

export default function ContainerDetailPage() {
  const { containerNo } = useParams();
  const navigate = useNavigate();
  const { loadingListGuangzhou, loadingListYiwu, updateLoadingListEntry } = useStore();
  const allEntries = [...loadingListGuangzhou, ...loadingListYiwu];
  const [selectMode, setSelectMode] = useState(false);
  const [selectedInView, setSelectedInView] = useState<Set<string>>(new Set());
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<ConsignmentStatus | ''>('');

  const decodedContainer = containerNo ? decodeURIComponent(containerNo) : '';

  const entries = useMemo(() => {
    if (!decodedContainer) return [];
    const result: typeof allEntries = [];
    allEntries.forEach(e => {
      if (e.container === decodedContainer) result.push(e);
      else if (e.kerung.some(k => k.nylamContainer === decodedContainer)) result.push(e);
      else if (e.tatopani.some(t => t.nylamContainer === decodedContainer)) result.push(e);
    });
    return result;
  }, [allEntries, decodedContainer]);

  // Calculate loaded CTN for each entry from loading lists
  const getLoadedCTN = (entry: typeof allEntries[0]) => {
    let loaded = 0;
    entry.tatopani.forEach(t => { if (t.loadedCTN) loaded += t.loadedCTN; });
    entry.kerung.forEach(k => { if (k.loadedCTN) loaded += k.loadedCTN; });
    return loaded || null;
  };

  const selectAll = () => setSelectedInView(new Set(entries.map(e => e.id)));

  const applyEditStatus = () => {
    selectedInView.forEach(id => {
      const inGz = loadingListGuangzhou.find(e => e.id === id);
      if (inGz) updateLoadingListEntry(id, 'guangzhou', { status: editStatus as ConsignmentStatus });
      const inYw = loadingListYiwu.find(e => e.id === id);
      if (inYw) updateLoadingListEntry(id, 'yiwu', { status: editStatus as ConsignmentStatus });
    });
    setSelectedInView(new Set());
    setEditStatusOpen(false);
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/containers')}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Container: {decodedContainer}</h2>
      </div>

      <div className="flex gap-2 mb-4">
        {!selectMode ? (
          <Button variant="outline" size="sm" className="font-bold" onClick={() => setSelectMode(true)}>Select</Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="font-bold" onClick={selectAll}>Select All</Button>
            <Button variant="outline" size="sm" className="font-bold" onClick={() => { setSelectMode(false); setSelectedInView(new Set()); }}>Cancel</Button>
            {selectedInView.size > 0 && (
              <Button variant="outline" size="sm" className="font-bold" onClick={() => setEditStatusOpen(true)}>Edit Status ({selectedInView.size})</Button>
            )}
          </>
        )}
      </div>

      <div className="table-container border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              {selectMode && <th className="p-2 text-left font-bold">✓</th>}
              <th className="p-2 text-left font-bold">Date</th>
              <th className="p-2 text-left font-bold">Consignment No.</th>
              <th className="p-2 text-left font-bold">MARKA</th>
              <th className="p-2 text-left font-bold">Total CTN</th>
              <th className="p-2 text-left font-bold">Loaded CTN</th>
              <th className="p-2 text-left font-bold">CBM</th>
              <th className="p-2 text-left font-bold">GW</th>
              <th className="p-2 text-left font-bold">Destination</th>
              <th className="p-2 text-left font-bold">Status</th>
              <th className="p-2 text-left font-bold">Client</th>
              <th className="p-2 text-left font-bold">LOT No.</th>
              <th className="p-2 text-left font-bold">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
              const loadedCTN = getLoadedCTN(e);
              return (
                <tr key={e.id} className={`border-b hover:bg-accent/50 ${getDestinationClass(e.destination) ? 'text-destructive' : ''}`}>
                  {selectMode && <td className="p-2"><input type="checkbox" checked={selectedInView.has(e.id)} onChange={() => { const n = new Set(selectedInView); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setSelectedInView(n); }} /></td>}
                  <td className="p-2 font-bold">{e.date}</td>
                  <td className="p-2 font-bold">{e.consignmentNo}</td>
                  <td className="p-2 font-bold">{e.marka}</td>
                  <td className="p-2 font-bold">{e.totalCTN}</td>
                  <td className="p-2 font-bold text-primary">{loadedCTN ?? '—'}</td>
                  <td className="p-2 font-bold">{e.cbm}</td>
                  <td className="p-2 font-bold">{e.gw}</td>
                  <td className={`p-2 font-bold ${getDestinationClass(e.destination)}`}>{e.destination}</td>
                  <td className="p-2"><span className={`status-badge text-base font-bold ${getStatusClass(e.status)}`}>{e.status || '-'}</span></td>
                  <td className="p-2 font-bold">{e.client}</td>
                  <td className="p-2 font-bold">{e.lotNo}</td>
                  <td className="p-2 font-bold">{e.remarks}</td>
                </tr>
              );
            })}
            {entries.length === 0 && <tr><td colSpan={selectMode ? 14 : 13} className="p-8 text-center text-muted-foreground font-bold">No entries found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={editStatusOpen} onOpenChange={setEditStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-bold">Edit Status</DialogTitle></DialogHeader>
          <Select value={editStatus || 'none'} onValueChange={(v) => setEditStatus(v === 'none' ? '' : v as ConsignmentStatus)}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={applyEditStatus} className="font-bold">Apply</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
