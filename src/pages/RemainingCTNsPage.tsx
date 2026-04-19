import React, { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Trash2, Pencil } from 'lucide-react';
import TableToolbar from '@/components/TableToolbar';
import { formatLastModified } from '@/lib/formatDate';
import * as XLSX from 'xlsx';

export default function RemainingCTNsPage() {
  const { remainingCTNs, addRemainingCTN, updateRemainingCTN, deleteRemainingCTN } = useStore();
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: '', consignmentNo: '', marka: '', totalCTN: 0, cbm: 0, gw: 0, destination: '', remainingCTN: 0, remainingCTNLocation: '', client: '' });

  const filtered = useMemo(() =>
    remainingCTNs.filter(e => {
      const s = search.toLowerCase();
      return !s || e.consignmentNo.toLowerCase().includes(s) || e.marka.toLowerCase().includes(s) || e.client.toLowerCase().includes(s);
    }), [remainingCTNs, search]);

  const handleSave = () => {
    const saveData = { ...form, createdBy: '', updatedBy: '', updatedAt: '' };
    if (editId) { updateRemainingCTN(editId, saveData); setEditId(null); }
    else addRemainingCTN(saveData);
    setAddOpen(false);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(({ id, ...r }) => r));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Remaining CTNs');
    XLSX.writeFile(wb, 'remaining_ctns.xlsx');
  };

  const handleImport = (data: any[]) => {
    data.forEach((row) => {
      addRemainingCTN({
        date: row['Date'] || row['date'] || '',
        consignmentNo: row['Consignment No.'] || row['consignmentNo'] || '',
        marka: row['MARKA'] || row['marka'] || '',
        totalCTN: Number(row['Total CTN'] || row['Total CTNS'] || row['totalCTN'] || 0),
        cbm: Number(row['CBM'] || row['cbm'] || 0),
        gw: Number(row['GW'] || row['gw'] || 0),
        destination: row['Destination'] || row['destination'] || '',
        remainingCTN: Number(row['Remaining CTN'] || row['remainingCTN'] || 0),
        remainingCTNLocation: row['Location'] || row['Remaining CTN Location'] || row['remainingCTNLocation'] || '',
        client: row['Client'] || row['client'] || '',
        createdBy: '', updatedBy: '', updatedAt: '',
      } as any);
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Remaining CTNs</h2>
      <TableToolbar
        searchValue={search} onSearchChange={setSearch}
        onAdd={() => { setEditId(null); setForm({ date: '', consignmentNo: '', marka: '', totalCTN: 0, cbm: 0, gw: 0, destination: '', remainingCTN: 0, remainingCTNLocation: '', client: '' }); setAddOpen(true); }}
        onExport={handleExport} onImport={handleImport}
        onSelectToggle={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
        selectMode={selectMode} selectedCount={selected.size}
      />
      <div className="table-container border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="p-2 text-left font-bold">Date</th>
              <th className="p-2 text-left font-bold">Consignment No.</th>
              <th className="p-2 text-left font-bold">MARKA</th>
              <th className="p-2 text-left font-bold highlight-field">Total CTN</th>
              <th className="p-2 text-left font-bold">CBM</th>
              <th className="p-2 text-left font-bold">GW</th>
              <th className="p-2 text-left font-bold">Destination</th>
              <th className="p-2 text-left font-bold highlight-field">Remaining CTN</th>
              <th className="p-2 text-left font-bold">Location</th>
              <th className="p-2 text-left font-bold">Client</th>
              <th className="p-2 text-left font-bold">Created By</th>
              <th className="p-2 text-left font-bold">Updated By</th>
              <th className="p-2 text-left font-bold">Last Modified</th>
              <th className="p-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b hover:bg-accent/50">
                <td className="p-2">{e.date}</td>
                <td className="p-2 font-medium">{e.consignmentNo}</td>
                <td className="p-2">{e.marka}</td>
                <td className="p-2 highlight-field">{e.totalCTN}</td>
                <td className="p-2">{e.cbm}</td>
                <td className="p-2">{e.gw}</td>
                <td className="p-2">{e.destination}</td>
                <td className="p-2 highlight-field">{e.remainingCTN}</td>
                <td className="p-2">{e.remainingCTNLocation}</td>
                <td className="p-2">{e.client}</td>
                <td className="p-2 text-xs text-muted-foreground">{e.createdBy || '-'}</td>
                <td className="p-2 text-xs text-muted-foreground">{e.updatedBy || '-'}</td>
                <td className="p-2 text-xs text-muted-foreground">{formatLastModified(e.updatedAt)}</td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button onClick={() => { setForm(e); setEditId(e.id); setAddOpen(true); }} className="p-1 hover:bg-accent rounded"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteRemainingCTN(e.id)} className="p-1 hover:bg-accent rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">No entries found</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-bold">{editId ? 'Edit' : 'Add'} Remaining CTN</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-medium">Date</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Consignment No.</label><Input value={form.consignmentNo} onChange={(e) => setForm({ ...form, consignmentNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">MARKA</label><Input value={form.marka} onChange={(e) => setForm({ ...form, marka: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Total CTN</label><Input type="number" value={form.totalCTN} onChange={(e) => setForm({ ...form, totalCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">CBM</label><Input type="number" step="0.01" value={form.cbm} onChange={(e) => setForm({ ...form, cbm: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">GW</label><Input type="number" step="0.01" value={form.gw} onChange={(e) => setForm({ ...form, gw: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">Destination</label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Remaining CTN</label><Input type="number" value={form.remainingCTN} onChange={(e) => setForm({ ...form, remainingCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">Location</label><Input value={form.remainingCTNLocation} onChange={(e) => setForm({ ...form, remainingCTNLocation: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Client</label><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
          </div>
          <Button className="mt-3 w-full" onClick={handleSave}>{editId ? 'Update' : 'Add'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
