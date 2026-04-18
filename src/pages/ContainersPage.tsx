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

export default function ContainersPage() {
  const { loadingListGuangzhou, loadingListYiwu, updateLoadingListEntry, addLoadingListEntry } = useStore();
  const allEntries = [...loadingListGuangzhou, ...loadingListYiwu];
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editContainer, setEditContainer] = useState<string | null>(null);
  const [editType, setEditType] = useState<'origin' | 'kerung' | 'tatopani'>('origin');
  const [editForm, setEditForm] = useState({ containerNo: '', dispatchedDate: '', dispatchedFrom: '', arrivalDate: '', arrivalLocation: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ containerNo: '', dispatchedDate: '', dispatchedFrom: 'Guangzhou', consignmentNo: '' });
  const navigate = useNavigate();

  const containerMap = useMemo(() => {
    const map = new Map<string, { containerNo: string; entries: typeof allEntries; dispatchedFrom: string; dispatchedDate: string; arrivalDate: string; arrivalLocation: string; type: 'origin' | 'kerung' | 'tatopani' }>();
    
    const addToMap = (containerNo: string, entry: typeof allEntries[0], dispatchedFrom: string, dispatchedDate: string, arrivalDate: string, arrivalLocation: string, type: 'origin' | 'kerung' | 'tatopani') => {
      // Key by container name + dispatched date only (no type prefix) to merge duplicates
      const key = `${containerNo}:${dispatchedDate}`;
      if (!map.has(key)) {
        map.set(key, { containerNo, entries: [], dispatchedFrom, dispatchedDate, arrivalDate, arrivalLocation, type });
      }
      const existing = map.get(key)!;
      if (!existing.entries.some(ex => ex.id === entry.id)) existing.entries.push(entry);
      // Update arrival info if this row has better data
      if (!existing.arrivalDate && arrivalDate) existing.arrivalDate = arrivalDate;
      if (!existing.arrivalLocation && arrivalLocation) existing.arrivalLocation = arrivalLocation;
    };

    allEntries.forEach(e => {
      if (e.container) {
        const date = e.dispatchedFrom || '';
        addToMap(e.container, e, e.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu', date, e.arrivalDateNylam || '', e.arrivalDateNylam ? 'Nylam' : '', 'origin');
      }
      e.kerung.forEach(k => {
        if (k.nylamContainer) {
          addToMap(k.nylamContainer, e, 'Nylam', k.dispatchedFromNylam || '', k.arrivalDate, 'Kerung', 'kerung');
        }
      });
      e.tatopani.forEach(t => {
        if (t.nylamContainer) {
          addToMap(t.nylamContainer, e, 'Nylam', t.dispatchedFromNylam || '', t.arrivalDate, 'Tatopani', 'tatopani');
        }
      });
    });
    // Sort by most recent dispatched date (descending)
    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.dispatchedDate || '';
      const dateB = b.dispatchedDate || '';
      return dateB.localeCompare(dateA);
    });
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

  const handleAddNew = async () => {
    if (!addForm.containerNo.trim()) {
      toast({ title: 'Error', description: 'Container No. is required', variant: 'destructive' });
      return;
    }
    const origin = addForm.dispatchedFrom === 'Yiwu' ? 'yiwu' : 'guangzhou' as 'guangzhou' | 'yiwu';
    await addLoadingListEntry({
      date: addForm.dispatchedDate,
      consignmentNo: addForm.consignmentNo || `CTN-${Date.now()}`,
      marka: '',
      totalCTN: 0,
      cbm: 0,
      gw: 0,
      destination: 'TATOPANI' as any,
      status: '' as any,
      client: '',
      remarks: '',
      lotNo: '',
      dispatchedFrom: addForm.dispatchedDate,
      container: addForm.containerNo,
      arrivalDateNylam: '',
      arrivalAtLhasa: '',
      lhasaContainer: '',
      dispatchedFromLhasa: '',
      lhasa: [],
      kerung: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
      tatopani: [{ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' }],
      followUp: false,
      origin,
      createdBy: '',
      updatedBy: '',
      updatedAt: '',
    }, origin);
    toast({ title: 'Success', description: `Container "${addForm.containerNo}" added` });
    setAddOpen(false);
    setAddForm({ containerNo: '', dispatchedDate: '', dispatchedFrom: 'Guangzhou', consignmentNo: '' });
  };

  const handleExport = () => {
    const COMPANY_HEADER = [
      ['义乌市阿卓国际供应链管理有限公司'],
      ['ADO INTERNATIONAL SUPPLY CHAIN MANAGEMENT CO LTD'],
      ['广东省广州市白云区石井镇凰岗村领龙国际1F001档'],
      ['Nepal: +977 9851067385 / 9851066781', '', 'Chinese Speaking Mobile: +8613322519322'],
      ['Kerung: +8613889021731', '', 'Nepali Speaking Mobile: +8619908916803'],
      ['Tatopani: +977 9846207176', '', 'Email: 1973459072@qq.com'],
      ['Lhasa: +8613728961850', '', 'Kathmandu'],
      [],
    ];
    const toExport = selected.size > 0 ? containerMap.filter(c => selected.has(c.containerNo)) : filtered;
    const data = toExport.map(c => ({
      'Container No.': c.containerNo,
      'Total Consignments': c.entries.length,
      'Dispatched Date': c.dispatchedDate,
      'Dispatched From': c.dispatchedFrom,
      'Arrival Date': c.arrivalDate,
      'Arrival Location': c.arrivalLocation,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(COMPANY_HEADER);
    const startRow = COMPANY_HEADER.length;
    XLSX.utils.sheet_add_json(ws, data, { origin: `A${startRow + 1}` });
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerCell = XLSX.utils.encode_cell({ r: startRow, c: C });
      if (ws[headerCell]) ws[headerCell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
      for (let R = startRow + 1; R <= range.e.r; R++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cell]) ws[cell].s = { alignment: { horizontal: 'center' } };
      }
    }
    ws['!cols'] = Array.from({ length: range.e.c + 1 }, () => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Containers');
    XLSX.writeFile(wb, 'containers.xlsx');
  };

  const handleImport = (rows: any[]) => {
    let imported = 0;
    rows.forEach(row => {
      const containerNo = row['Container No.'] || row['container'] || row['containerNo'] || row['Container'] || '';
      const consignmentNo = row['Consignment No.'] || row['consignment_no'] || row['consignmentNo'] || '';
      const dispatchedDate = row['Dispatched Date'] || row['dispatched_date'] || '';
      const dispatchedFrom = row['Dispatched From'] || row['dispatched_from'] || 'Guangzhou';
      if (!containerNo) return;

      const origin = dispatchedFrom.toLowerCase().includes('yiwu') ? 'yiwu' : 'guangzhou' as 'guangzhou' | 'yiwu';

      // Check if an existing entry has this consignment and update its container
      const list = origin === 'yiwu' ? loadingListYiwu : loadingListGuangzhou;
      const existing = consignmentNo ? list.find(e => e.consignmentNo === consignmentNo) : null;
      if (existing) {
        updateLoadingListEntry(existing.id, origin, { container: containerNo, dispatchedFrom: dispatchedDate });
      } else {
        addLoadingListEntry({
          date: dispatchedDate,
          consignmentNo: consignmentNo || `CTN-${Date.now()}-${imported}`,
          marka: row['Marka'] || row['marka'] || '',
          totalCTN: Number(row['Total CTN'] || row['total_ctn'] || 0),
          cbm: Number(row['CBM'] || row['cbm'] || 0),
          gw: Number(row['GW'] || row['gw'] || 0),
          destination: 'TATOPANI' as any,
          status: '' as any,
          client: row['Client'] || row['client'] || '',
          remarks: '',
          lotNo: '',
          dispatchedFrom: dispatchedDate,
          container: containerNo,
          arrivalDateNylam: '',
          arrivalAtLhasa: '',
          lhasaContainer: '',
          dispatchedFromLhasa: '',
          lhasa: [],
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
    toast({ title: 'Import Complete', description: `${imported} container(s) imported` });
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Containers</h2>
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

      {/* Add New Container Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-bold">Add New Container</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">Container No. *</label><Input value={addForm.containerNo} onChange={(e) => setAddForm({ ...addForm, containerNo: e.target.value })} placeholder="e.g. CNTR-001" /></div>
            <div><label className="text-xs font-medium">Consignment No.</label><Input value={addForm.consignmentNo} onChange={(e) => setAddForm({ ...addForm, consignmentNo: e.target.value })} placeholder="Optional" /></div>
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
            <Button onClick={handleAddNew} className="w-full">Add Container</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Container Dialog */}
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
