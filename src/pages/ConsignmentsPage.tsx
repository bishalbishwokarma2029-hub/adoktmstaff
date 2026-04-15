import React, { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Trash2, Pencil } from 'lucide-react';
import TableToolbar from '@/components/TableToolbar';
import { DESTINATIONS, STATUSES, getStatusClass, getDestinationClass } from '@/types';
import type { Consignment, Destination, ConsignmentStatus } from '@/types';
import { formatLastModified } from '@/lib/formatDate';
import * as XLSX from 'xlsx';

const emptyConsignment: Omit<Consignment, 'id'> = {
  date: new Date().toISOString().split('T')[0],
  consignmentNo: '', marka: '', totalCTN: 0, cbm: 0, gw: 0,
  destination: 'TATOPANI', status: '', client: '', remarks: '',
  createdBy: '', updatedBy: '', updatedAt: '',
};

export default function ConsignmentsPage() {
  const { consignments, loadingListGuangzhou, loadingListYiwu, addConsignment, updateConsignment, deleteConsignment } = useStore();
  const allLoading = [...loadingListGuangzhou, ...loadingListYiwu];
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyConsignment);
  const [masterStatus, setMasterStatus] = useState<ConsignmentStatus | ''>('');
  const [masterClient, setMasterClient] = useState('');

  const filtered = useMemo(() =>
    consignments.filter((c) => {
      const s = search.toLowerCase();
      return !s || c.consignmentNo.toLowerCase().includes(s) || c.marka.toLowerCase().includes(s)
        || c.client.toLowerCase().includes(s) || c.destination.toLowerCase().includes(s);
    }), [consignments, search]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleExport = () => {
    const toExport = selected.size > 0
      ? consignments.filter(c => selected.has(c.id))
      : filtered;

    const headers = ['Consignment Date', 'Consignment No', 'Client Name', 'Marka', 'T.CTNS', 'T.CBM', 'T.GW', 'Destination', 'Status', 'Remarks'];
    const rows = toExport.map(c => [
      c.date, c.consignmentNo, c.client, c.marka, c.totalCTN, c.cbm, c.gw, c.destination, c.status, c.remarks
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const totalCols = headers.length;
    const totalRows = rows.length + 1;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: totalCols - 1 } });

    for (let C = 0; C < totalCols; C++) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[headerCell]) ws[headerCell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
      for (let R = 1; R < totalRows; R++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cell]) ws[cell].s = { alignment: { horizontal: 'center' } };
      }
    }
    ws['!cols'] = Array.from({ length: totalCols }, () => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Consignments');
    XLSX.writeFile(wb, 'consignments.xlsx');
  };

  const handleImport = (data: any[]) => {
    data.forEach((row) => {
      addConsignment({
        date: row['Date'] || row['date'] || new Date().toISOString().split('T')[0],
        consignmentNo: row['Consignment Number'] || row['consignmentNo'] || row['Consignment No.'] || '',
        marka: row['MARKA'] || row['marka'] || '',
        totalCTN: Number(row['Total CTNS'] || row['totalCTN'] || 0),
        cbm: Number(row['CBM'] || row['cbm'] || 0),
        gw: Number(row['GW'] || row['gw'] || 0),
        destination: (row['Destination'] || row['destination'] || 'TATOPANI') as Destination,
        status: row['Status'] || row['status'] || '',
        client: row['Client'] || row['client'] || '',
        remarks: row['Remarks'] || row['remarks'] || '',
        createdBy: '', updatedBy: '', updatedAt: '',
      });
    });
  };

  const handleSave = () => {
    if (editId) {
      updateConsignment(editId, form);
      setEditId(null);
    } else {
      addConsignment(form);
    }
    setForm(emptyConsignment);
    setAddOpen(false);
  };

  const applyMasterEdit = () => {
    selected.forEach((id) => {
      const updates: Partial<Consignment> = {};
      if (masterStatus) updates.status = masterStatus;
      if (masterClient) updates.client = masterClient;
      updateConsignment(id, updates);
    });
    setSelected(new Set());
    setMasterStatus('');
    setMasterClient('');
  };

  // View: find loading list entry to show all details
  const viewConsignment = viewId ? consignments.find((c) => c.id === viewId) : null;
  const viewLoadingEntry = viewConsignment ? allLoading.find(e => e.consignmentNo === viewConsignment.consignmentNo) : null;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Consignments</h2>

      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => { setForm(emptyConsignment); setEditId(null); setAddOpen(true); }}
        onExport={handleExport}
        onImport={handleImport}
        onSelectToggle={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
        selectMode={selectMode}
        selectedCount={selected.size}
        masterEditContent={
          <div className="space-y-3">
            <div>
              <label className="text-sm font-bold">Status</label>
              <Select value={masterStatus} onValueChange={(v) => setMasterStatus(v as ConsignmentStatus)}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold">Client</label>
              <Input value={masterClient} onChange={(e) => setMasterClient(e.target.value)} />
            </div>
            <Button onClick={applyMasterEdit}>Apply to Selected</Button>
          </div>
        }
      />

      <div className="table-container border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              {selectMode && <th className="p-2 text-left sticky left-0 z-30 w-[40px]"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelected(new Set(filtered.map(c => c.id))); else setSelected(new Set()); }} /></th>}
              <th className="p-2 text-left font-bold whitespace-nowrap sticky left-0 z-30 min-w-[140px]">Consignment No.</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Date</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">MARKA</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Total CTNS</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">CBM</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">GW</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Destination</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Status</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Client</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Remarks</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Created By</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Updated By</th>
              <th className="p-2 text-left font-bold whitespace-nowrap">Last Modified</th>
              <th className="p-2 text-left font-bold whitespace-nowrap sticky right-0 z-30 min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={`border-b hover:bg-accent/50 ${getDestinationClass(c.destination) ? 'text-destructive' : ''}`}>
                {selectMode && (
                  <td className="p-2 sticky left-0 bg-card z-10">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  </td>
                )}
                <td className="p-2 whitespace-nowrap font-bold sticky left-0 bg-card z-10">{c.consignmentNo}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.date}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.marka}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.totalCTN}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.cbm}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.gw}</td>
                <td className={`p-2 whitespace-nowrap font-bold ${getDestinationClass(c.destination)}`}>{c.destination}</td>
                <td className="p-2 whitespace-nowrap"><span className={`status-badge text-base font-bold ${getStatusClass(c.status)}`}>{c.status || '-'}</span></td>
                <td className="p-2 whitespace-nowrap font-bold">{c.client}</td>
                <td className="p-2 whitespace-nowrap font-bold">{c.remarks}</td>
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{c.createdBy || '-'}</td>
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{c.updatedBy || '-'}</td>
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{formatLastModified(c.updatedAt)}</td>
                <td className="p-2 whitespace-nowrap sticky right-0 bg-card z-10">
                  <div className="flex gap-1">
                    <button onClick={() => setViewId(c.id)} className="p-1 hover:bg-accent rounded" title="View"><Eye className="h-4 w-4 text-primary" /></button>
                    <button onClick={() => { setForm(c); setEditId(c.id); setAddOpen(true); }} className="p-1 hover:bg-accent rounded" title="Edit"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={() => deleteConsignment(c.id)} className="p-1 hover:bg-accent rounded" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={14} className="p-8 text-center text-muted-foreground font-bold">No consignments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-bold">{editId ? 'Edit' : 'Add'} Consignment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold">Date</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-xs font-bold">Consignment No.</label><Input value={form.consignmentNo} onChange={(e) => setForm({ ...form, consignmentNo: e.target.value })} /></div>
            <div><label className="text-xs font-bold">MARKA</label><Input value={form.marka} onChange={(e) => setForm({ ...form, marka: e.target.value })} /></div>
            <div><label className="text-xs font-bold">Total CTNS</label><Input type="number" value={form.totalCTN} onChange={(e) => setForm({ ...form, totalCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-bold">CBM</label><Input type="number" step="0.01" value={form.cbm} onChange={(e) => setForm({ ...form, cbm: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-bold">GW</label><Input type="number" step="0.01" value={form.gw} onChange={(e) => setForm({ ...form, gw: Number(e.target.value) })} /></div>
            <div>
              <label className="text-xs font-bold">Destination</label>
              <Select value={form.destination} onValueChange={(v) => setForm({ ...form, destination: v as Destination })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DESTINATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold">Status</label>
              <Select value={form.status || 'none'} onValueChange={(v) => setForm({ ...form, status: v === 'none' ? '' : v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs font-bold">Client</label><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
            <div><label className="text-xs font-bold">Remarks</label><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <Button className="mt-3 w-full" onClick={handleSave}>{editId ? 'Update' : 'Add'} Consignment</Button>
        </DialogContent>
      </Dialog>

      {/* View Dialog - Show full loading list details */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-bold text-lg">Consignment Details</DialogTitle></DialogHeader>
          {viewConsignment && (
            <div className="space-y-4">
              {/* Status prominently */}
              <div className="text-center">
                <span className={`status-badge text-lg px-6 py-2 font-bold ${getStatusClass(viewConsignment.status)}`}>
                  {viewConsignment.status || 'No Status'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Date</span><span className="font-bold text-base">{viewConsignment.date}</span></div>
                <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Consignment No.</span><span className="font-bold text-lg">{viewConsignment.consignmentNo}</span></div>
                <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">MARKA</span><span className="font-bold text-lg">{viewConsignment.marka}</span></div>
                <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Total CTN</span><span className="font-bold text-lg">{viewConsignment.totalCTN}</span></div>
                <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">CBM</span><span className="font-bold text-base">{viewConsignment.cbm}</span></div>
                <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">GW</span><span className="font-bold text-base">{viewConsignment.gw}</span></div>
                <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Destination</span><span className={`font-bold text-base ${getDestinationClass(viewConsignment.destination)}`}>{viewConsignment.destination}</span></div>
                <div className="bg-warning/20 border border-warning/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Client</span><span className="font-bold text-lg">{viewConsignment.client}</span></div>
                <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Remarks</span><span className="font-bold text-base">{viewConsignment.remarks || '-'}</span></div>
              </div>

              {/* Loading list details if available */}
              {viewLoadingEntry && (
                <>
                  <h3 className="font-bold text-base border-b pb-1">Loading List Details</h3>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">LOT No.</span><span className="font-bold text-base">{viewLoadingEntry.lotNo || '-'}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Dispatched From</span><span className="font-bold text-base">{viewLoadingEntry.dispatchedFrom || '-'}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Container</span><span className="font-bold text-base">{viewLoadingEntry.container || '-'}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Arrival at Nylam</span><span className="font-bold text-base">{viewLoadingEntry.arrivalDateNylam || '-'}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Origin</span><span className="font-bold text-base">{viewLoadingEntry.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu'}</span></div>
                    <div className="bg-accent/30 rounded p-3"><span className="font-bold block text-xs text-muted-foreground">Follow Up</span><span className="font-bold text-base">{viewLoadingEntry.followUp ? '✅ Done' : '⬜ Pending'}</span></div>
                  </div>

                  {/* Kerung & Tatopani */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3">
                      <h4 className="font-bold text-destructive mb-2">🔴 KERUNG ({viewLoadingEntry.kerung.length} rows)</h4>
                      {viewLoadingEntry.kerung.map((k, i) => (
                        <div key={i} className="border rounded p-2 bg-destructive/5 grid grid-cols-3 gap-1.5 text-xs mb-1.5">
                          <div><span className="font-bold">Dispatched:</span> {k.dispatchedFromNylam || '-'}</div>
                          <div><span className="font-bold">Loaded:</span> {k.loadedCTN ?? '-'}</div>
                          <div><span className="font-bold">Container:</span> {k.nylamContainer || '-'}</div>
                          <div><span className="font-bold">Status:</span> <span className={getStatusClass(k.status)}>{k.status || '-'}</span></div>
                          <div><span className="font-bold">Received:</span> {k.receivedCTN ?? '-'}</div>
                          <div><span className="font-bold">Arrival:</span> {k.arrivalDate || '-'}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border rounded-lg p-3">
                      <h4 className="font-bold text-orange-700 mb-2">🔶 TATOPANI ({viewLoadingEntry.tatopani.length} rows)</h4>
                      {viewLoadingEntry.tatopani.map((t, i) => (
                        <div key={i} className="border rounded p-2 bg-accent/20 grid grid-cols-3 gap-1.5 text-xs mb-1.5">
                          <div><span className="font-bold">Dispatched:</span> {t.dispatchedFromNylam || '-'}</div>
                          <div><span className="font-bold">Loaded:</span> {t.loadedCTN ?? '-'}</div>
                          <div><span className="font-bold">Container:</span> {t.nylamContainer || '-'}</div>
                          <div><span className="font-bold">Status:</span> <span className={getStatusClass(t.status)}>{t.status || '-'}</span></div>
                          <div><span className="font-bold">Received:</span> {t.receivedCTN ?? '-'}</div>
                          <div><span className="font-bold">Arrival:</span> {t.arrivalDate || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
