import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TableToolbar from '@/components/TableToolbar';
import { formatLastModified } from '@/lib/formatDate';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export default function LotwisePage() {
  const { loadingListGuangzhou, loadingListYiwu, updateLoadingListEntry, addLoadingListEntry } = useStore();
  const allEntries = [...loadingListGuangzhou, ...loadingListYiwu];
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editLot, setEditLot] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ lotNo: '', container: '', dispatchedDate: '', dispatchedFrom: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ lotNo: '', container: '', dispatchedDate: '', dispatchedFrom: 'Guangzhou', consignmentNo: '' });
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

  const handleAddNew = async () => {
    if (!addForm.lotNo.trim()) {
      toast({ title: 'Error', description: 'LOT No. is required', variant: 'destructive' });
      return;
    }
    const origin = addForm.dispatchedFrom === 'Yiwu' ? 'yiwu' : 'guangzhou' as 'guangzhou' | 'yiwu';
    await addLoadingListEntry({
      date: addForm.dispatchedDate,
      consignmentNo: addForm.consignmentNo || `LOT-${Date.now()}`,
      marka: '',
      totalCTN: 0,
      cbm: 0,
      gw: 0,
      destination: 'TATOPANI' as any,
      status: '' as any,
      client: '',
      remarks: '',
      lotNo: addForm.lotNo,
      dispatchedFrom: addForm.dispatchedDate,
      container: addForm.container,
      arrivalDateNylam: '',
      arrivalAtLhasa: '',
      lhasaContainer: '',
      dispatchedFromLhasa: '',
      kerung: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
      tatopani: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
      followUp: false,
      origin,
      createdBy: '',
      updatedBy: '',
      updatedAt: '',
    }, origin);
    toast({ title: 'Success', description: `LOT "${addForm.lotNo}" added` });
    setAddOpen(false);
    setAddForm({ lotNo: '', container: '', dispatchedDate: '', dispatchedFrom: 'Guangzhou', consignmentNo: '' });
  };

  const handleExport = () => {
    const data = filtered.map(l => ({
      'LOT No.': l.lotNo,
      'Container No.': l.container,
      'Total Consignments': l.entries.length,
      'Dispatched Date': l.dispatchedDate,
      'Dispatched From': l.dispatchedFrom,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lots');
    XLSX.writeFile(wb, 'lotwise.xlsx');
  };

  const handleImport = (rows: any[]) => {
    let imported = 0;
    rows.forEach(row => {
      const lotNo = row['LOT No.'] || row['lot_no'] || row['lotNo'] || row['Lot No'] || '';
      const containerNo = row['Container No.'] || row['container'] || row['containerNo'] || '';
      const consignmentNo = row['Consignment No.'] || row['consignment_no'] || row['consignmentNo'] || '';
      const dispatchedDate = row['Dispatched Date'] || row['dispatched_date'] || '';
      const dispatchedFrom = row['Dispatched From'] || row['dispatched_from'] || 'Guangzhou';
      if (!lotNo) return;

      const origin = dispatchedFrom.toLowerCase().includes('yiwu') ? 'yiwu' : 'guangzhou' as 'guangzhou' | 'yiwu';

      // Check if an existing entry has this consignment and update its lot
      const list = origin === 'yiwu' ? loadingListYiwu : loadingListGuangzhou;
      const existing = consignmentNo ? list.find(e => e.consignmentNo === consignmentNo) : null;
      if (existing) {
        updateLoadingListEntry(existing.id, origin, { lotNo, container: containerNo, dispatchedFrom: dispatchedDate });
      } else {
        addLoadingListEntry({
          date: dispatchedDate,
          consignmentNo: consignmentNo || `LOT-${Date.now()}-${imported}`,
          marka: row['Marka'] || row['marka'] || '',
          totalCTN: Number(row['Total CTN'] || row['total_ctn'] || 0),
          cbm: Number(row['CBM'] || row['cbm'] || 0),
          gw: Number(row['GW'] || row['gw'] || 0),
          destination: 'TATOPANI' as any,
          status: '' as any,
          client: row['Client'] || row['client'] || '',
          remarks: '',
          lotNo,
          dispatchedFrom: dispatchedDate,
          container: containerNo,
          arrivalDateNylam: '',
          arrivalAtLhasa: '',
          lhasaContainer: '',
          dispatchedFromLhasa: '',
          kerung: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
          tatopani: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
          followUp: false,
          origin,
          createdBy: '',
          updatedBy: '',
          updatedAt: '',
        }, origin);
      }
      imported++;
    });
    toast({ title: 'Import Complete', description: `${imported} lot(s) imported` });
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Lotwise Consignments</h2>
      <TableToolbar
        searchValue={search} onSearchChange={setSearch}
        onAdd={() => setAddOpen(true)} onExport={handleExport} onImport={handleImport}
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

      {/* Add New LOT Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-bold">Add New LOT</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">LOT No. *</label><Input value={addForm.lotNo} onChange={(e) => setAddForm({ ...addForm, lotNo: e.target.value })} placeholder="e.g. LOT-001" /></div>
            <div><label className="text-xs font-medium">Consignment No.</label><Input value={addForm.consignmentNo} onChange={(e) => setAddForm({ ...addForm, consignmentNo: e.target.value })} placeholder="Optional" /></div>
            <div><label className="text-xs font-medium">Container No.</label><Input value={addForm.container} onChange={(e) => setAddForm({ ...addForm, container: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched Date</label><Input type="date" value={addForm.dispatchedDate} onChange={(e) => setAddForm({ ...addForm, dispatchedDate: e.target.value })} /></div>
            <div>
              <label className="text-xs font-medium">Dispatched From</label>
              <Select value={addForm.dispatchedFrom} onValueChange={(v) => setAddForm({ ...addForm, dispatchedFrom: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Guangzhou">Guangzhou</SelectItem>
                  <SelectItem value="Yiwu">Yiwu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddNew} className="w-full">Add LOT</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit LOT Dialog */}
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
