import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { getStatusClass, getDestinationClass, STATUSES, DESTINATIONS } from '@/types';
import type { LoadingListEntry, ConsignmentStatus, Destination } from '@/types';
import { formatLastModified } from '@/lib/formatDate';

function getTotalReceived(e: LoadingListEntry): number {
  const recTatopani = e.tatopani.reduce((s, t) => s + (t.receivedCTN || 0), 0);
  const recKerung = e.kerung.reduce((s, k) => s + (k.receivedCTN || 0), 0);
  return recTatopani + recKerung;
}

function isComplete(e: LoadingListEntry): boolean {
  if (e.destination === 'NYLAM') return false;
  const received = getTotalReceived(e);
  return received > 0 && e.totalCTN === received;
}

function isPartial(e: LoadingListEntry): boolean {
  if (e.destination === 'NYLAM') return false;
  const received = getTotalReceived(e);
  return received > 0 && e.totalCTN !== received;
}

function FollowUpTable({ entries, type }: { entries: LoadingListEntry[]; type: 'complete' | 'partial' }) {
  const [search, setSearch] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const navigate = useNavigate();
  const store = useStore();

  const filtered = useMemo(() =>
    entries.filter(e => {
      const s = search.toLowerCase();
      return !s || e.consignmentNo.toLowerCase().includes(s) || e.marka.toLowerCase().includes(s) || e.client.toLowerCase().includes(s);
    }), [entries, search]);

  const viewItem = viewId ? entries.find(e => e.id === viewId) : null;
  const editItem = editId ? entries.find(e => e.id === editId) : null;
  const [editForm, setEditForm] = useState<Partial<LoadingListEntry>>({});

  const openEdit = (e: LoadingListEntry) => {
    setEditForm({
      date: e.date, consignmentNo: e.consignmentNo, marka: e.marka, totalCTN: e.totalCTN,
      cbm: e.cbm, gw: e.gw, destination: e.destination, status: e.status,
      client: e.client, remarks: e.remarks, followUp: e.followUp,
      lotNo: e.lotNo, dispatchedFrom: e.dispatchedFrom, container: e.container,
      arrivalDateNylam: e.arrivalDateNylam, arrivalAtLhasa: e.arrivalAtLhasa,
      lhasaContainer: e.lhasaContainer, dispatchedFromLhasa: e.dispatchedFromLhasa,
    });
    setEditId(e.id);
  };

  const saveEdit = () => {
    if (!editItem) return;
    store.updateLoadingListEntry(editItem.id, editItem.origin, editForm);
    setEditId(null);
  };

  const handleDelete = (e: LoadingListEntry) => {
    if (!confirm(`Remove follow-up flag from "${e.consignmentNo}"?`)) return;
    store.updateLoadingListEntry(e.id, e.origin, { followUp: false });
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={() => navigate('/loading-lists')}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="table-container border rounded-lg">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="p-2 text-left font-bold">Consignment No.</th>
              <th className="p-2 text-left font-bold">MARKA</th>
              <th className="p-2 text-left font-bold">Total CTN</th>
              <th className="p-2 text-left font-bold">Received CTN</th>
              <th className="p-2 text-left font-bold">CBM</th>
              <th className="p-2 text-left font-bold">GW</th>
              <th className="p-2 text-left font-bold">Destination</th>
              <th className="p-2 text-left font-bold">Status</th>
              <th className="p-2 text-left font-bold">Client Name</th>
              <th className="p-2 text-left font-bold">Remarks</th>
              <th className="p-2 text-left font-bold">Created By</th>
              <th className="p-2 text-left font-bold">Updated By</th>
              <th className="p-2 text-left font-bold">Last Modified</th>
              <th className="p-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className={`border-b hover:bg-accent/50 ${getDestinationClass(e.destination) ? 'text-destructive' : ''}`}>
                <td className="p-2 font-bold">{e.consignmentNo}</td>
                <td className="p-2 font-bold">{e.marka}</td>
                <td className="p-2 font-bold">{e.totalCTN}</td>
                <td className="p-2 font-bold">{getTotalReceived(e)}</td>
                <td className="p-2 font-bold">{e.cbm}</td>
                <td className="p-2 font-bold">{e.gw}</td>
                <td className={`p-2 font-bold ${getDestinationClass(e.destination)}`}>{e.destination}</td>
                <td className="p-2"><span className={`status-badge ${getStatusClass(e.status)}`}>{e.status || '-'}</span></td>
                <td className="p-2 font-bold">{e.client}</td>
                <td className="p-2 font-bold">{e.remarks}</td>
                <td className="p-2 text-xs text-muted-foreground">{e.createdBy || '-'}</td>
                <td className="p-2 text-xs text-muted-foreground">{e.updatedBy || '-'}</td>
                <td className="p-2 text-xs text-muted-foreground">{formatLastModified(e.updatedAt)}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button onClick={() => setViewId(e.id)} className="p-1 hover:bg-accent rounded"><Eye className="h-4 w-4 text-primary" /></button>
                    <button onClick={() => openEdit(e)} className="p-1 hover:bg-accent rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={() => handleDelete(e)} className="p-1 hover:bg-accent rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={13} className="p-8 text-center text-muted-foreground font-bold">No {type} follow-up entries found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-bold">Follow Up Details</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Consignment No.</span><span className="font-bold text-lg">{viewItem.consignmentNo}</span></div>
              <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">MARKA</span><span className="font-bold text-lg">{viewItem.marka}</span></div>
              <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Total CTN</span><span className="font-bold text-lg">{viewItem.totalCTN}</span></div>
              <div className="bg-primary/10 rounded p-2 border border-primary/20"><span className="font-bold block text-xs text-muted-foreground">Received CTN</span><span className="text-lg font-bold">{getTotalReceived(viewItem)}</span></div>
              <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">CBM</span><span className="font-bold">{viewItem.cbm}</span></div>
              <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">GW</span><span className="font-bold">{viewItem.gw}</span></div>
              <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Destination</span><span className={`font-bold ${getDestinationClass(viewItem.destination)}`}>{viewItem.destination}</span></div>
              <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Status</span><span className={`status-badge ${getStatusClass(viewItem.status)}`}>{viewItem.status || '-'}</span></div>
              <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Client</span><span className="font-bold text-lg">{viewItem.client || '-'}</span></div>
              <div className="bg-accent/30 rounded p-2 col-span-3"><span className="font-bold block text-xs text-muted-foreground">Remarks</span><span className="font-bold">{viewItem.remarks || '-'}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-bold">Edit Follow Up Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-medium">Date</label><Input type="date" value={editForm.date || ''} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Consignment No.</label><Input value={editForm.consignmentNo || ''} onChange={(e) => setEditForm({ ...editForm, consignmentNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">MARKA</label><Input value={editForm.marka || ''} onChange={(e) => setEditForm({ ...editForm, marka: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Total CTN</label><Input type="number" value={editForm.totalCTN || 0} onChange={(e) => setEditForm({ ...editForm, totalCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">CBM</label><Input type="number" step="0.01" value={editForm.cbm || 0} onChange={(e) => setEditForm({ ...editForm, cbm: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">GW</label><Input type="number" step="0.01" value={editForm.gw || 0} onChange={(e) => setEditForm({ ...editForm, gw: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">Destination</label>
              <Select value={editForm.destination || 'TATOPANI'} onValueChange={(v) => setEditForm({ ...editForm, destination: v as Destination })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DESTINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs font-medium">Status</label>
              <Select value={editForm.status || 'none'} onValueChange={(v) => setEditForm({ ...editForm, status: v === 'none' ? '' : v as ConsignmentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">--</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs font-medium">Client</label><Input value={editForm.client || ''} onChange={(e) => setEditForm({ ...editForm, client: e.target.value })} /></div>
            <div><label className="text-xs font-medium">LOT No.</label><Input value={editForm.lotNo || ''} onChange={(e) => setEditForm({ ...editForm, lotNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched From</label><Input value={editForm.dispatchedFrom || ''} onChange={(e) => setEditForm({ ...editForm, dispatchedFrom: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Container</label><Input value={editForm.container || ''} onChange={(e) => setEditForm({ ...editForm, container: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival at Nylam</label><Input type="date" value={editForm.arrivalDateNylam || ''} onChange={(e) => setEditForm({ ...editForm, arrivalDateNylam: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival at Lhasa</label><Input type="date" value={editForm.arrivalAtLhasa || ''} onChange={(e) => setEditForm({ ...editForm, arrivalAtLhasa: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Lhasa Container</label><Input value={editForm.lhasaContainer || ''} onChange={(e) => setEditForm({ ...editForm, lhasaContainer: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched from Lhasa</label><Input value={editForm.dispatchedFromLhasa || ''} onChange={(e) => setEditForm({ ...editForm, dispatchedFromLhasa: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs font-medium">Remarks</label><Input value={editForm.remarks || ''} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></div>
          </div>
          <Button onClick={saveEdit} className="w-full mt-3">Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function PartyFollowUpPage() {
  const { loadingListGuangzhou, loadingListYiwu } = useStore();
  const allEntries = [...loadingListGuangzhou, ...loadingListYiwu];
  const navigate = useNavigate();

  const completeEntries = useMemo(() => {
    const nonNylam = allEntries.filter(e => e.followUp && isComplete(e));
    const nylam = allEntries.filter(e => e.destination === 'NYLAM' && e.followUp);
    return [...nonNylam, ...nylam];
  }, [allEntries]);

  const partialEntries = useMemo(() => {
    return allEntries.filter(e => e.followUp && isPartial(e));
  }, [allEntries]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Party Follow Up</h2>
      <Tabs defaultValue="complete">
        <TabsList>
          <TabsTrigger value="complete" className="font-bold">Complete</TabsTrigger>
          <TabsTrigger value="partial" className="font-bold">Partial</TabsTrigger>
        </TabsList>
        <TabsContent value="complete">
          <FollowUpTable entries={completeEntries} type="complete" />
        </TabsContent>
        <TabsContent value="partial">
          <FollowUpTable entries={partialEntries} type="partial" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
