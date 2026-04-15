import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TableToolbar from '@/components/TableToolbar';
import { formatLastModified } from '@/lib/formatDate';

export default function LotwisePage() {
  const { loadingListGuangzhou, loadingListYiwu, updateLoadingListEntry } = useStore();
  const allEntries = [...loadingListGuangzhou, ...loadingListYiwu];
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editLot, setEditLot] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ lotNo: '', container: '', dispatchedDate: '', dispatchedFrom: '' });
  const navigate = useNavigate();

  const lotMap = useMemo(() => {
    const map = new Map<string, { lotNo: string; entries: typeof allEntries; container: string; dispatchedDate: string; dispatchedFrom: string }>();
    allEntries.forEach(e => {
      if (!e.lotNo) return;
      if (!map.has(e.lotNo)) {
        map.set(e.lotNo, { lotNo: e.lotNo, entries: [], container: e.container, dispatchedDate: e.dispatchedFrom, dispatchedFrom: e.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu' });
      }
      map.get(e.lotNo)!.entries.push(e);
    });
    return Array.from(map.values());
  }, [allEntries]);

  const filtered = useMemo(() => lotMap.filter(l => !search || l.lotNo.toLowerCase().includes(search.toLowerCase())), [lotMap, search]);

  const handleDelete = (l: typeof filtered[0]) => {
    if (!confirm(`Clear LOT "${l.lotNo}" from all entries?`)) return;
    l.entries.forEach(entry => {
      updateLoadingListEntry(entry.id, entry.origin, { lotNo: '' });
    });
  };

  const handleEdit = (l: typeof filtered[0]) => {
    setEditLot(l.lotNo);
    setEditForm({ lotNo: l.lotNo, container: l.container, dispatchedDate: l.dispatchedDate, dispatchedFrom: l.dispatchedFrom });
  };

  const handleEditSave = () => {
    const lot = lotMap.find(l => l.lotNo === editLot);
    if (!lot) return;
    lot.entries.forEach(entry => {
      updateLoadingListEntry(entry.id, entry.origin, { lotNo: editForm.lotNo, container: editForm.container, dispatchedFrom: editForm.dispatchedDate });
    });
    setEditLot(null);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Lotwise Consignments</h2>
      <TableToolbar
        searchValue={search} onSearchChange={setSearch}
        onAdd={() => {}} onExport={() => {}} onImport={() => {}}
        onSelectToggle={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
        selectMode={selectMode} selectedCount={selected.size}
      />
      <div className="table-container border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="p-2 text-left font-bold">LOT No.</th>
              <th className="p-2 text-left font-bold">Container No.</th>
              <th className="p-2 text-left font-bold">Total Consignments</th>
              <th className="p-2 text-left font-bold">Dispatched Date</th>
              <th className="p-2 text-left font-bold">Dispatched From</th>
              <th className="p-2 text-left font-bold">Created By</th>
              <th className="p-2 text-left font-bold">Updated By</th>
              <th className="p-2 text-left font-bold">Last Modified</th>
              <th className="p-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.lotNo} className="border-b hover:bg-accent/50 cursor-pointer">
                <td className="p-2 font-bold text-primary" onClick={() => navigate(`/lotwise/${encodeURIComponent(l.lotNo)}`)}>{l.lotNo}</td>
                <td className="p-2 font-bold">{l.container}</td>
                <td className="p-2 font-bold">{l.entries.length}</td>
                <td className="p-2 font-bold">{l.dispatchedDate}</td>
                <td className="p-2 font-bold">{l.dispatchedFrom}</td>
                <td className="p-2 text-xs text-muted-foreground">{l.entries[0]?.createdBy || '-'}</td>
                <td className="p-2 text-xs text-muted-foreground">{l.entries[0]?.updatedBy || '-'}</td>
                <td className="p-2 text-xs text-muted-foreground">{formatLastModified(l.entries[0]?.updatedAt)}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/lotwise/${encodeURIComponent(l.lotNo)}`)} className="p-1 hover:bg-accent rounded"><Eye className="h-4 w-4 text-primary" /></button>
                    <button onClick={(ev) => { ev.stopPropagation(); handleEdit(l); }} className="p-1 hover:bg-accent rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={(ev) => { ev.stopPropagation(); handleDelete(l); }} className="p-1 hover:bg-accent rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground font-bold">No lots found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editLot} onOpenChange={() => setEditLot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-bold">Edit LOT</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">LOT No.</label><Input value={editForm.lotNo} onChange={(e) => setEditForm({ ...editForm, lotNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Container No.</label><Input value={editForm.container} onChange={(e) => setEditForm({ ...editForm, container: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched Date</label><Input value={editForm.dispatchedDate} onChange={(e) => setEditForm({ ...editForm, dispatchedDate: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched From</label><Input value={editForm.dispatchedFrom} onChange={(e) => setEditForm({ ...editForm, dispatchedFrom: e.target.value })} /></div>
            <Button onClick={handleEditSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
