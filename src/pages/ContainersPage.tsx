import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TableToolbar from '@/components/TableToolbar';
import { formatLastModified } from '@/lib/formatDate';

export default function ContainersPage() {
  const { loadingListGuangzhou, loadingListYiwu, updateLoadingListEntry, deleteLoadingListEntry } = useStore();
  const allEntries = [...loadingListGuangzhou, ...loadingListYiwu];
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editContainer, setEditContainer] = useState<string | null>(null);
  const [editType, setEditType] = useState<'origin' | 'kerung' | 'tatopani'>('origin');
  const [editForm, setEditForm] = useState({ containerNo: '', dispatchedDate: '', dispatchedFrom: '', arrivalDate: '', arrivalLocation: '' });
  const navigate = useNavigate();

  const containerMap = useMemo(() => {
    const map = new Map<string, { containerNo: string; entries: typeof allEntries; dispatchedFrom: string; dispatchedDate: string; arrivalDate: string; arrivalLocation: string; type: 'origin' | 'kerung' | 'tatopani' }>();
    allEntries.forEach(e => {
      if (e.container) {
        if (!map.has(e.container)) map.set(e.container, { containerNo: e.container, entries: [], dispatchedFrom: e.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu', dispatchedDate: e.dispatchedFrom, arrivalDate: '', arrivalLocation: '', type: 'origin' });
        map.get(e.container)!.entries.push(e);
      }
      e.kerung.forEach(k => {
        if (k.nylamContainer) {
          if (!map.has(k.nylamContainer)) map.set(k.nylamContainer, { containerNo: k.nylamContainer, entries: [], dispatchedFrom: 'Nylam', dispatchedDate: k.dispatchedFromNylam, arrivalDate: k.arrivalDate, arrivalLocation: 'Kerung', type: 'kerung' });
          map.get(k.nylamContainer)!.entries.push(e);
        }
      });
      e.tatopani.forEach(t => {
        if (t.nylamContainer) {
          if (!map.has(t.nylamContainer)) map.set(t.nylamContainer, { containerNo: t.nylamContainer, entries: [], dispatchedFrom: 'Nylam', dispatchedDate: t.dispatchedFromNylam, arrivalDate: t.arrivalDate, arrivalLocation: 'Tatopani', type: 'tatopani' });
          map.get(t.nylamContainer)!.entries.push(e);
        }
      });
    });
    return Array.from(map.values());
  }, [allEntries]);

  const filtered = useMemo(() =>
    containerMap.filter(c => !search || c.containerNo.toLowerCase().includes(search.toLowerCase())),
    [containerMap, search]);

  const handleDelete = (c: typeof filtered[0]) => {
    if (!confirm(`Delete container "${c.containerNo}" and clear it from all entries?`)) return;
    c.entries.forEach(entry => {
      const origin = entry.origin;
      if (c.type === 'origin' && entry.container === c.containerNo) {
        updateLoadingListEntry(entry.id, origin, { container: '' });
      }
      if (c.type === 'kerung') {
        const newKerung = entry.kerung.map(k => k.nylamContainer === c.containerNo ? { ...k, nylamContainer: '' } : k);
        updateLoadingListEntry(entry.id, origin, { kerung: newKerung });
      }
      if (c.type === 'tatopani') {
        const newTatopani = entry.tatopani.map(t => t.nylamContainer === c.containerNo ? { ...t, nylamContainer: '' } : t);
        updateLoadingListEntry(entry.id, origin, { tatopani: newTatopani });
      }
    });
  };

  const handleEdit = (c: typeof filtered[0]) => {
    setEditContainer(c.containerNo);
    setEditType(c.type);
    setEditForm({ containerNo: c.containerNo, dispatchedDate: c.dispatchedDate, dispatchedFrom: c.dispatchedFrom, arrivalDate: c.arrivalDate, arrivalLocation: c.arrivalLocation });
  };

  const handleEditSave = () => {
    const old = containerMap.find(c => c.containerNo === editContainer);
    if (!old) return;
    old.entries.forEach(entry => {
      const origin = entry.origin;
      if (old.type === 'origin') {
        updateLoadingListEntry(entry.id, origin, {
          container: editForm.containerNo,
          dispatchedFrom: editForm.dispatchedDate,
          arrivalDateNylam: editForm.arrivalDate,
        });
      }
      if (old.type === 'kerung') {
        const newKerung = entry.kerung.map(k => k.nylamContainer === editContainer ? { ...k, nylamContainer: editForm.containerNo, dispatchedFromNylam: editForm.dispatchedDate, arrivalDate: editForm.arrivalDate } : k);
        updateLoadingListEntry(entry.id, origin, { kerung: newKerung });
      }
      if (old.type === 'tatopani') {
        const newTatopani = entry.tatopani.map(t => t.nylamContainer === editContainer ? { ...t, nylamContainer: editForm.containerNo, dispatchedFromNylam: editForm.dispatchedDate, arrivalDate: editForm.arrivalDate } : t);
        updateLoadingListEntry(entry.id, origin, { tatopani: newTatopani });
      }
    });
    setEditContainer(null);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Containers</h2>
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
              <th className="p-2 text-left font-bold whitespace-nowrap">Container No.</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Total Consignments</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Dispatched Date</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Dispatched From</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Arrival Date</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Arrival Location</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Created By</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Updated By</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Last Modified</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.containerNo} className="border-b hover:bg-accent/50 cursor-pointer">
                <td className="p-2 whitespace-nowrap font-bold text-primary" onClick={() => navigate(`/containers/${encodeURIComponent(c.containerNo)}`)}>{c.containerNo}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.entries.length}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.dispatchedDate}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.dispatchedFrom}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.arrivalDate}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.arrivalLocation}</td>
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{c.entries[0]?.createdBy || '-'}</td>
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{c.entries[0]?.updatedBy || '-'}</td>
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{formatLastModified(c.entries[0]?.updatedAt)}</td>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/containers/${encodeURIComponent(c.containerNo)}`)} className="p-1 hover:bg-accent rounded"><Eye className="h-4 w-4 text-primary" /></button>
                    <button onClick={(ev) => { ev.stopPropagation(); handleEdit(c); }} className="p-1 hover:bg-accent rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={(ev) => { ev.stopPropagation(); handleDelete(c); }} className="p-1 hover:bg-accent rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground font-bold">No containers found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editContainer} onOpenChange={() => setEditContainer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-bold">Edit Container</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">Container No.</label><Input value={editForm.containerNo} onChange={(e) => setEditForm({ ...editForm, containerNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched Date</label><Input value={editForm.dispatchedDate} onChange={(e) => setEditForm({ ...editForm, dispatchedDate: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched From</label><Input value={editForm.dispatchedFrom} onChange={(e) => setEditForm({ ...editForm, dispatchedFrom: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival Date</label><Input value={editForm.arrivalDate} onChange={(e) => setEditForm({ ...editForm, arrivalDate: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival Location</label><Input value={editForm.arrivalLocation} onChange={(e) => setEditForm({ ...editForm, arrivalLocation: e.target.value })} /></div>
            <Button onClick={handleEditSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
