import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Trash2, Pencil, ChevronDown, ChevronRight, Check } from 'lucide-react';
import TableToolbar from '@/components/TableToolbar';
import { DESTINATIONS, STATUSES, getStatusClass, getDestinationClass } from '@/types';
import type { LoadingListEntry, Destination, ConsignmentStatus, KerungDetails, TatopaniDetails, LhasaDetails, OldNylamEntry } from '@/types';
import { formatLastModified } from '@/lib/formatDate';
import DebouncedInput from '@/components/DebouncedInput';
import * as XLSX from 'xlsx';

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
const emptyKerung = (): KerungDetails => ({ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' });
const emptyTatopani = (): TatopaniDetails => ({ dispatchedFromNylam: '', loadedCTN: null, nylamContainer: '', status: '', receivedCTN: null, arrivalDate: '' });
const emptyLhasa = (loadedCTN: number | null = null): LhasaDetails => ({ nylamContainer: '', dispatchedFromLhasa: '', loadedCTN, arrivedAtNylam: '' });

function calcRemainingAtNylam(e: LoadingListEntry): number | null {
  const lhasa = e.remainingCTNLhasa ?? 0;
  let totalLoaded = 0;
  let hasAny = false;
  e.tatopani.forEach(t => { if (t.loadedCTN) { totalLoaded += t.loadedCTN; hasAny = true; } });
  e.kerung.forEach(k => { if (k.loadedCTN) { totalLoaded += k.loadedCTN; hasAny = true; } });
  if (!hasAny && e.remainingCTNLhasa == null) return null;
  return e.totalCTN - lhasa - totalLoaded;
}

function calcOnTheWay(e: LoadingListEntry): number | null {
  let total = 0;
  let hasAny = false;
  e.tatopani.forEach(t => { if (t.status === 'On the way to Tatopani' && t.loadedCTN) { total += t.loadedCTN; hasAny = true; } });
  e.kerung.forEach(k => { if (k.status === 'On the way to Kerung' && k.loadedCTN) { total += k.loadedCTN; hasAny = true; } });
  return hasAny ? total : null;
}

function calcMissing(e: LoadingListEntry): number | null {
  let missing = 0;
  let hasAny = false;
  e.tatopani.forEach(t => {
    if (t.receivedCTN != null && t.loadedCTN && !t.status?.includes('On the way')) {
      missing += (t.loadedCTN - t.receivedCTN);
      hasAny = true;
    }
  });
  e.kerung.forEach(k => {
    if (k.receivedCTN != null && k.loadedCTN && !k.status?.includes('On the way')) {
      missing += (k.loadedCTN - k.receivedCTN);
      hasAny = true;
    }
  });
  return hasAny ? missing : null;
}

function calcRemaining(e: LoadingListEntry): number | null {
  let totalLoaded = 0;
  let hasLoaded = false;
  e.tatopani.forEach(t => { if (t.loadedCTN) { totalLoaded += t.loadedCTN; hasLoaded = true; } });
  e.kerung.forEach(k => { if (k.loadedCTN) { totalLoaded += k.loadedCTN; hasLoaded = true; } });
  return hasLoaded ? e.totalCTN - totalLoaded : null;
}

function LoadingListTable({ origin }: { origin: 'guangzhou' | 'yiwu' }) {
  const store = useStore();
  const list = origin === 'guangzhou' ? store.loadingListGuangzhou : store.loadingListYiwu;
  const cityName = origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu';
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [expandedKerung, setExpandedKerung] = useState<Set<string>>(new Set());
  const [expandedTatopani, setExpandedTatopani] = useState<Set<string>>(new Set());
  const [tatopaniEditOpen, setTatopaniEditOpen] = useState(false);
  const [kerungEditOpen, setKerungEditOpen] = useState(false);
  const [bulkTatopani, setBulkTatopani] = useState({ dispatched: '', container: '', status: '' as any, arrivalDate: '' });
  const [bulkKerung, setBulkKerung] = useState({ dispatched: '', container: '', status: '' as any, arrivalDate: '' });
  const [masterLot, setMasterLot] = useState('');
  const [masterDispatched, setMasterDispatched] = useState('');
  const [masterContainer, setMasterContainer] = useState('');
  const [masterStatus, setMasterStatus] = useState<ConsignmentStatus | ''>('');
  const [expandedLhasa, setExpandedLhasa] = useState<Set<string>>(new Set());
  const [masterArrivalLhasa, setMasterArrivalLhasa] = useState('');
  const [masterLhasaContainer, setMasterLhasaContainer] = useState('');
  const [masterDispatchedLhasa, setMasterDispatchedLhasa] = useState('');
  const [masterArrivalNylam, setMasterArrivalNylam] = useState('');

  const [form, setForm] = useState<Partial<LoadingListEntry>>({
    date: new Date().toISOString().split('T')[0], consignmentNo: '', marka: '', totalCTN: 0, cbm: 0, gw: 0,
    destination: 'TATOPANI', status: '', client: '', remarks: '', lotNo: '', dispatchedFrom: '',
    container: '', arrivalDateNylam: '', arrivalAtLhasa: '', lhasaContainer: '', dispatchedFromLhasa: '',
    followUp: false, lhasa: [], kerung: [emptyKerung()], tatopani: [emptyTatopani()],
  });

  const filtered = useMemo(() =>
    list.filter((e) => {
      const s = search.toLowerCase();
      return !s || e.consignmentNo.toLowerCase().includes(s) || e.marka.toLowerCase().includes(s) || e.client.toLowerCase().includes(s);
    }), [list, search]);

  const handleExport = () => {
    const toExport = selected.size > 0 ? list.filter(e => selected.has(e.id)) : filtered;
    const data = toExport.map(({ id, kerung, tatopani, origin: o, ...rest }) => rest);
    const wb = XLSX.utils.book_new();
    const headerRows = COMPANY_HEADER;
    const ws = XLSX.utils.aoa_to_sheet(headerRows);
    const startRow = headerRows.length;
    XLSX.utils.sheet_add_json(ws, data, { origin: `A${startRow + 1}` });
    // Style: bold headers, center align all data
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; C++) {
      const headerCell = XLSX.utils.encode_cell({ r: startRow, c: C });
      if (ws[headerCell]) {
        ws[headerCell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
      }
      for (let R = startRow + 1; R <= range.e.r; R++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cell]) {
          if (!ws[cell].s) ws[cell].s = {};
          ws[cell].s = { alignment: { horizontal: 'center' } };
        }
      }
    }
    // Company header styling
    for (let R = 0; R < startRow; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cell]) {
          ws[cell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
        }
      }
    }
    ws['!cols'] = Array.from({ length: range.e.c + 1 }, () => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, cityName);
    XLSX.writeFile(wb, `loading_list_${origin}.xlsx`);
  };

  const handleImport = (data: any[]) => {
    data.forEach((row) => {
      store.addLoadingListEntry({
        date: row['Date'] || row['date'] || new Date().toISOString().split('T')[0],
        consignmentNo: row['Consignment No.'] || row['consignmentNo'] || '',
        marka: row['MARKA'] || row['marka'] || '',
        totalCTN: Number(row['Total CTNS'] || row['totalCTN'] || 0),
        cbm: Number(row['CBM'] || row['cbm'] || 0),
        gw: Number(row['GW'] || row['gw'] || 0),
        destination: (row['Destination'] || 'TATOPANI') as Destination,
        status: row['Status'] || '',
        client: row['Client'] || row['client'] || '',
        remarks: row['Remarks'] || row['remarks'] || '',
        lotNo: row['LOT No.'] || row['lotNo'] || '',
        dispatchedFrom: row[`Dispatched from ${cityName}`] || '',
        container: row[`${cityName} Container`] || '',
        arrivalDateNylam: row['Arrival Date at Nylam'] || '',
        arrivalAtLhasa: row['Arrival at Lhasa'] || '',
        lhasaContainer: row['Lhasa Container'] || '',
        dispatchedFromLhasa: row['Dispatched from Lhasa'] || '',
        lhasa: [],
        kerung: [emptyKerung()],
        tatopani: [emptyTatopani()],
        followUp: false,
        origin, createdBy: '', updatedBy: '', updatedAt: '',
      }, origin);
    });
  };

  const handleSave = () => {
    if (editId) {
      store.updateLoadingListEntry(editId, origin, form);
      setEditId(null);
    } else {
      store.addLoadingListEntry(form as any, origin);
    }
    setAddOpen(false);
  };

  const applyMasterEdit = () => {
    selected.forEach((id) => {
      const updates: Partial<LoadingListEntry> = {};
      if (masterLot) updates.lotNo = masterLot;
      if (masterDispatched) updates.dispatchedFrom = masterDispatched;
      if (masterContainer) updates.container = masterContainer;
      if (masterStatus) updates.status = masterStatus;
      if (masterArrivalNylam) updates.arrivalDateNylam = masterArrivalNylam;
      if (masterArrivalLhasa) updates.arrivalAtLhasa = masterArrivalLhasa;
      if (masterLhasaContainer) updates.lhasaContainer = masterLhasaContainer;
      if (masterDispatchedLhasa) updates.dispatchedFromLhasa = masterDispatchedLhasa;
      store.updateLoadingListEntry(id, origin, updates);
    });
    setSelected(new Set());
  };

  const applyBulkTatopani = () => {
    selected.forEach((id) => {
      const entry = list.find(e => e.id === id);
      if (!entry) return;
      const newTatopani = entry.tatopani.map(t => ({
        ...t,
        dispatchedFromNylam: bulkTatopani.dispatched || t.dispatchedFromNylam,
        nylamContainer: bulkTatopani.container || t.nylamContainer,
        status: bulkTatopani.status || t.status,
        arrivalDate: bulkTatopani.arrivalDate || t.arrivalDate,
      }));
      store.updateLoadingListEntry(id, origin, { tatopani: newTatopani });
    });
    setTatopaniEditOpen(false);
  };

  const applyBulkKerung = () => {
    selected.forEach((id) => {
      const entry = list.find(e => e.id === id);
      if (!entry) return;
      const newKerung = entry.kerung.map(k => ({
        ...k,
        dispatchedFromNylam: bulkKerung.dispatched || k.dispatchedFromNylam,
        nylamContainer: bulkKerung.container || k.nylamContainer,
        status: bulkKerung.status || k.status,
        arrivalDate: bulkKerung.arrivalDate || k.arrivalDate,
      }));
      store.updateLoadingListEntry(id, origin, { kerung: newKerung });
    });
    setKerungEditOpen(false);
  };

  const toggleFollowUp = (id: string) => {
    const entry = list.find(e => e.id === id);
    if (entry) store.updateLoadingListEntry(id, origin, { followUp: !entry.followUp });
  };

  const viewItem = viewId ? list.find(e => e.id === viewId) : null;

  return (
    <div>
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => { setForm({ date: new Date().toISOString().split('T')[0], consignmentNo: '', marka: '', totalCTN: 0, cbm: 0, gw: 0, destination: 'TATOPANI', status: '', client: '', remarks: '', lotNo: '', dispatchedFrom: '', container: '', arrivalDateNylam: '', arrivalAtLhasa: '', lhasaContainer: '', dispatchedFromLhasa: '', followUp: false, lhasa: [], kerung: [emptyKerung()], tatopani: [emptyTatopani()] }); setEditId(null); setAddOpen(true); }}
        onExport={handleExport}
        onImport={handleImport}
        onSelectToggle={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
        selectMode={selectMode}
        selectedCount={selected.size}
        masterEditContent={
          <div className="space-y-3">
            <div><label className="text-xs font-medium">LOT No.</label><Input value={masterLot} onChange={(e) => setMasterLot(e.target.value)} /></div>
            <div><label className="text-xs font-medium">Dispatched from {cityName}</label><Input value={masterDispatched} onChange={(e) => setMasterDispatched(e.target.value)} /></div>
            <div><label className="text-xs font-medium">{cityName} Container</label><Input value={masterContainer} onChange={(e) => setMasterContainer(e.target.value)} /></div>
            <div><label className="text-xs font-medium">Status</label>
              <Select value={masterStatus || 'none'} onValueChange={(v) => setMasterStatus(v === 'none' ? '' : v as ConsignmentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">--</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs font-medium">Arrival At Nylam</label><Input type="date" value={masterArrivalNylam} onChange={(e) => setMasterArrivalNylam(e.target.value)} /></div>
            <div><label className="text-xs font-medium">Arrival at Lhasa</label><Input type="date" value={masterArrivalLhasa} onChange={(e) => setMasterArrivalLhasa(e.target.value)} /></div>
            <div><label className="text-xs font-medium">Lhasa Container</label><Input value={masterLhasaContainer} onChange={(e) => setMasterLhasaContainer(e.target.value)} /></div>
            <div><label className="text-xs font-medium">Dispatched from Lhasa</label><Input value={masterDispatchedLhasa} onChange={(e) => setMasterDispatchedLhasa(e.target.value)} /></div>
            <Button onClick={applyMasterEdit}>Apply to Selected</Button>
          </div>
        }
        extraButtons={
          selectMode && selected.size > 0 ? (
            <>
              <Dialog open={tatopaniEditOpen} onOpenChange={setTatopaniEditOpen}>
                <Button variant="outline" size="sm" onClick={() => setTatopaniEditOpen(true)}>TATOPANI Edit</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-bold">TATOPANI Edit ({selected.size} items)</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><label className="text-xs font-medium">Dispatched from Nylam to Tatopani</label><Input value={bulkTatopani.dispatched} onChange={(e) => setBulkTatopani({ ...bulkTatopani, dispatched: e.target.value })} /></div>
                    <div><label className="text-xs font-medium">Nylam Container for Tatopani</label><Input value={bulkTatopani.container} onChange={(e) => setBulkTatopani({ ...bulkTatopani, container: e.target.value })} /></div>
                    <div><label className="text-xs font-medium">Status</label>
                      <Select value={bulkTatopani.status || 'none'} onValueChange={(v) => setBulkTatopani({ ...bulkTatopani, status: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">--</SelectItem><SelectItem value="On the way to Tatopani">On the way to Tatopani</SelectItem><SelectItem value="At Tatopani port">At Tatopani port</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><label className="text-xs font-medium">Arrival Date at Tatopani</label><Input type="date" value={bulkTatopani.arrivalDate} onChange={(e) => setBulkTatopani({ ...bulkTatopani, arrivalDate: e.target.value })} /></div>
                    <Button onClick={applyBulkTatopani}>Apply</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={kerungEditOpen} onOpenChange={setKerungEditOpen}>
                <Button variant="outline" size="sm" onClick={() => setKerungEditOpen(true)}>KERUNG Edit</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-bold">KERUNG Edit ({selected.size} items)</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><label className="text-xs font-medium">Dispatched from Nylam to Kerung</label><Input value={bulkKerung.dispatched} onChange={(e) => setBulkKerung({ ...bulkKerung, dispatched: e.target.value })} /></div>
                    <div><label className="text-xs font-medium">Nylam Container for Kerung</label><Input value={bulkKerung.container} onChange={(e) => setBulkKerung({ ...bulkKerung, container: e.target.value })} /></div>
                    <div><label className="text-xs font-medium">Status</label>
                      <Select value={bulkKerung.status || 'none'} onValueChange={(v) => setBulkKerung({ ...bulkKerung, status: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">--</SelectItem><SelectItem value="On the way to Kerung">On the way to Kerung</SelectItem><SelectItem value="At Kerung port">At Kerung port</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><label className="text-xs font-medium">Arrival Date at Kerung</label><Input type="date" value={bulkKerung.arrivalDate} onChange={(e) => setBulkKerung({ ...bulkKerung, arrivalDate: e.target.value })} /></div>
                    <Button onClick={applyBulkKerung}>Apply</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : null
        }
      />

      <div className="table-container border rounded-lg">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr>
              {selectMode && <th className="p-1.5 text-left !sticky !left-0 !z-40 w-[30px] !bg-[hsl(48_100%_72%)]"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelected(new Set(filtered.map(c => c.id))); else setSelected(new Set()); }} /></th>}
              <th className="p-1.5 text-left font-bold whitespace-nowrap !sticky !left-0 !z-40 w-[130px] min-w-[130px] !bg-[hsl(48_100%_72%)]">Consignment No.</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap !sticky !left-[130px] !z-40 w-[140px] min-w-[140px] !bg-[hsl(48_100%_72%)]">MARKA</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap !sticky !left-[270px] !z-40 w-[90px] min-w-[90px] !bg-[hsl(48_100%_72%)]">Total CTNS</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap min-w-[100px] highlight-field">Loaded CTNS</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap min-w-[110px]">Date</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap min-w-[80px]">CBM</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap min-w-[80px]">GW</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Destination</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">LOT No.</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Dispatched from {cityName}</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">{cityName} Container</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Status</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Arrival at Lhasa</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap min-w-[110px] highlight-field">Received CTN at Lhasa</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap cursor-pointer">▸ LHASA</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Arrival at Nylam</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap min-w-[110px] highlight-field">Received CTN at Nylam</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap cursor-pointer">▸ KERUNG</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap cursor-pointer">▸ TATOPANI</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">On the Way</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">Missing CTN</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">Remaining CTN at Lhasa</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">Remaining CTN at Nylam</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Client</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Remarks</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Follow Up</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Created By</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Updated By</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Last Modified</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap sticky right-0 z-30 min-w-[90px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const onTheWay = calcOnTheWay(e);
              const missing = calcMissing(e);
              const remaining = calcRemainingAtNylam(e);
              const isKerungExpanded = expandedKerung.has(e.id);
              const isTatopaniExpanded = expandedTatopani.has(e.id);
              const isLhasaExpanded = expandedLhasa.has(e.id);

              return (
                <React.Fragment key={e.id}>
                  <tr className={`border-b hover:bg-accent/50 ${getDestinationClass(e.destination) ? 'text-destructive' : ''}`}>
                    {selectMode && <td className="p-1.5 sticky left-0 bg-card z-10"><input type="checkbox" checked={selected.has(e.id)} onChange={() => { const n = new Set(selected); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setSelected(n); }} /></td>}
                    <td className="p-1.5 whitespace-nowrap font-bold sticky left-0 bg-card z-10 w-[130px] min-w-[130px]">{e.consignmentNo}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold sticky left-[130px] bg-card z-10 w-[140px] min-w-[140px]">{e.marka}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold sticky left-[270px] bg-card z-10 w-[90px] min-w-[90px]">{e.totalCTN}</td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold p-0" title="Auto-fills from Total CTNS. Editable.">
                      <DebouncedInput
                        type="number"
                        className="h-8 text-center font-bold border-0 bg-transparent w-full highlight-field"
                        value={e.loadedCTNS ?? e.totalCTN ?? ''}
                        onChange={(v) => store.updateLoadingListEntry(e.id, origin, { loadedCTNS: v === '' ? null : Number(v) } as any)}
                      />
                    </td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.date}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.cbm}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.gw}</td>
                    <td className={`p-1.5 whitespace-nowrap font-bold ${getDestinationClass(e.destination)}`}>{e.destination}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.lotNo}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.dispatchedFrom}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.container}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold"><span className={`status-badge ${getStatusClass(e.status)}`}>{e.status || '-'}</span></td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.arrivalAtLhasa}</td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold p-0" title="Auto-fills from Total CTNS. Editable.">
                      <DebouncedInput
                        type="number"
                        className="h-8 text-center font-bold border-0 bg-transparent w-full highlight-field"
                        value={e.receivedCTNLhasa ?? e.totalCTN ?? ''}
                        onChange={(v) => store.updateLoadingListEntry(e.id, origin, { receivedCTNLhasa: v === '' ? null : Number(v) } as any)}
                      />
                    </td>
                    <td className="p-1.5 whitespace-nowrap">
                      <button onClick={() => { const n = new Set(expandedLhasa); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setExpandedLhasa(n); }} className="flex items-center gap-1 text-primary hover:underline font-bold">
                        {isLhasaExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} LHASA{(e.lhasa?.length ?? 0) > 0 ? ` (${e.lhasa.length})` : ''}
                      </button>
                    </td>
                    <td className="p-1.5 whitespace-nowrap font-bold align-top">
                      {(() => {
                        const raw = e.arrivalDateNylam || '';
                        // Preserve empty slots so newly-added blank dates remain editable
                        const dates = raw === '' ? [] : raw.split(',').map(d => d.trim());
                        const updateDates = (next: string[]) => store.updateLoadingListEntry(e.id, origin, { arrivalDateNylam: next.join(', ') } as any);
                        return (
                          <div className="flex flex-col gap-1 min-w-[160px]">
                            {dates.length === 0 && <span className="text-xs text-muted-foreground italic">No dates</span>}
                            {dates.map((d, di) => (
                              <div key={di} className="flex items-center gap-1">
                                <Input
                                  type="date"
                                  className="h-7 text-xs px-1 font-bold"
                                  value={d}
                                  onChange={(ev) => { const nd = [...dates]; nd[di] = ev.target.value; updateDates(nd); }}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateDates(dates.filter((_, i) => i !== di))}
                                  className="text-destructive hover:bg-accent rounded px-1.5 text-sm font-bold leading-none"
                                  title="Remove date"
                                >×</button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="text-[11px] px-1 self-start text-primary hover:underline font-bold"
                              onClick={() => updateDates([...dates, ''])}
                            >+ Add date</button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold p-0" title="Auto-fills from sum of Loaded CTN inside LHASA. Editable.">
                      {(() => {
                        const totalLhasaLoaded = (e.lhasa || []).reduce((s, l) => s + (l.loadedCTN || 0), 0);
                        const auto = totalLhasaLoaded > 0 ? totalLhasaLoaded : null;
                        const displayed = e.receivedCTNNylam ?? auto ?? '';
                        return (
                          <DebouncedInput
                            type="number"
                            className="h-8 text-center font-bold border-0 bg-transparent w-full highlight-field"
                            value={displayed}
                            onChange={(v) => store.updateLoadingListEntry(e.id, origin, { receivedCTNNylam: v === '' ? null : Number(v) } as any)}
                          />
                        );
                      })()}
                    </td>
                    <td className="p-1.5 whitespace-nowrap">
                      <button onClick={() => { const n = new Set(expandedKerung); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setExpandedKerung(n); }} className="flex items-center gap-1 text-primary hover:underline font-bold">
                        {isKerungExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} KERUNG
                      </button>
                    </td>
                    <td className="p-1.5 whitespace-nowrap">
                      <button onClick={() => { const n = new Set(expandedTatopani); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setExpandedTatopani(n); }} className="flex items-center gap-1 text-primary hover:underline font-bold">
                        {isTatopaniExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} TATOPANI
                      </button>
                    </td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold">{onTheWay ?? '-'}</td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold">{missing ?? '-'}</td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold p-0" title="Auto: Total CTNS − sum of Loaded CTN inside LHASA. Editable.">
                      {(() => {
                        const totalLhasaLoaded = (e.lhasa || []).reduce((s, l) => s + (l.loadedCTN || 0), 0);
                        const auto = totalLhasaLoaded > 0 ? e.totalCTN - totalLhasaLoaded : null;
                        const displayed = e.remainingCTNLhasa ?? auto ?? '';
                        return (
                          <DebouncedInput
                            type="number"
                            className="h-8 text-center font-bold border-0 bg-transparent w-full highlight-field"
                            value={displayed}
                            onChange={(v) => store.updateLoadingListEntry(e.id, origin, { remainingCTNLhasa: v === '' ? null : Number(v) } as any)}
                          />
                        );
                      })()}
                    </td>
                    <td className="p-1.5 whitespace-nowrap highlight-field font-bold" title="Auto: Total - Remaining at Lhasa - Loaded Tatopani - Loaded Kerung">{remaining ?? '-'}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.client}</td>
                    <td className="p-1.5 whitespace-nowrap font-bold">{e.remarks}</td>
                    <td className="p-1.5 whitespace-nowrap text-center">
                      <button onDoubleClick={() => toggleFollowUp(e.id)} className="p-1 hover:bg-accent rounded w-6 h-6 flex items-center justify-center" title="Double-click to toggle">
                        {e.followUp ? <Check className="h-4 w-4 text-green-600" /> : <span className="text-muted-foreground">-</span>}
                      </button>
                    </td>
                    <td className="p-1.5 whitespace-nowrap text-xs text-muted-foreground">{e.createdBy || '-'}</td>
                    <td className="p-1.5 whitespace-nowrap text-xs text-muted-foreground">{e.updatedBy || '-'}</td>
                    <td className="p-1.5 whitespace-nowrap text-xs text-muted-foreground">{formatLastModified(e.updatedAt)}</td>
                    <td className="p-1.5 whitespace-nowrap sticky right-0 bg-card z-10">
                      <div className="flex gap-0.5">
                        <button onClick={() => setViewId(e.id)} className="p-0.5 hover:bg-accent rounded"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                        <button onClick={() => { setForm(e); setEditId(e.id); setAddOpen(true); }} className="p-0.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => store.deleteLoadingListEntry(e.id, origin)} className="p-0.5 hover:bg-accent rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                  {(isKerungExpanded || isTatopaniExpanded || isLhasaExpanded) && (
                    <tr className="border-b">
                      <td colSpan={selectMode ? 31 : 30} className="p-0">
                        <div className="flex flex-col gap-3 py-3 px-4">
                          {isLhasaExpanded && (
                            <div className="border rounded-lg p-3 w-full max-w-md mx-auto bg-purple-50/40">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-purple-700 text-sm">▸ LHASA ({e.lhasa?.length ?? 0} containers)</span>
                                <div className="flex items-center gap-1 text-xs">
                                  <span>Total Containers:</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    className="h-6 w-14 text-xs text-center"
                                    value={e.lhasa?.length ?? 0}
                                    onChange={(ev) => {
                                      const n = Math.max(0, Number(ev.target.value) || 0);
                                      const current = e.lhasa || [];
                                      let next: LhasaDetails[];
                                      if (n > current.length) next = [...current, ...Array.from({ length: n - current.length }, () => emptyLhasa(e.totalCTN || null))];
                                      else next = current.slice(0, n);
                                      store.updateLoadingListEntry(e.id, origin, { lhasa: next } as any);
                                    }}
                                  />
                                </div>
                              </div>
                              {(e.lhasa?.length ?? 0) === 0 && (
                                <p className="text-xs text-muted-foreground italic mb-2">Enter the number of containers above to add Lhasa-Nylam container details.</p>
                              )}
                              {(e.lhasa || []).map((l, li) => (
                                <div key={li} className="border rounded p-2 mb-2 bg-accent/10">
                                  <p className="font-bold text-xs mb-1">Container {li + 1}</p>
                                  <div className="grid grid-cols-1 gap-2">
                                    <div>
                                      <label className="text-xs text-muted-foreground">Lhasa-Nylam Container</label>
                                      <DebouncedInput className="h-7 text-xs" value={l.nylamContainer} onChange={(v) => { const nl = [...(e.lhasa || [])]; nl[li] = { ...nl[li], nylamContainer: v }; store.updateLoadingListEntry(e.id, origin, { lhasa: nl } as any); }} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-muted-foreground">Dispatched from Lhasa</label>
                                      <DebouncedInput type="date" delay={100} className="h-7 text-xs" value={l.dispatchedFromLhasa} onChange={(v) => { const nl = [...(e.lhasa || [])]; nl[li] = { ...nl[li], dispatchedFromLhasa: v }; store.updateLoadingListEntry(e.id, origin, { lhasa: nl } as any); }} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-muted-foreground">Loaded CTN</label>
                                      <DebouncedInput type="number" className="h-7 text-xs" value={l.loadedCTN ?? (e.totalCTN || '')} onChange={(v) => { const nl = [...(e.lhasa || [])]; nl[li] = { ...nl[li], loadedCTN: v === '' ? null : Number(v) }; store.updateLoadingListEntry(e.id, origin, { lhasa: nl } as any); }} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-muted-foreground">Arrived at Nylam</label>
                                      <DebouncedInput type="date" delay={100} className="h-7 text-xs" value={l.arrivedAtNylam || ''} onChange={(v) => { const nl = [...(e.lhasa || [])]; nl[li] = { ...nl[li], arrivedAtNylam: v }; store.updateLoadingListEntry(e.id, origin, { lhasa: nl } as any); }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { const nl = [...(e.lhasa || []), emptyLhasa(e.totalCTN || null)]; store.updateLoadingListEntry(e.id, origin, { lhasa: nl } as any); }}>+ Add</Button>
                                {(e.lhasa?.length ?? 0) > 0 && <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { const nl = (e.lhasa || []).slice(0, -1); store.updateLoadingListEntry(e.id, origin, { lhasa: nl } as any); }}>- Remove</Button>}
                              </div>
                            </div>
                          )}
                          <div className={`flex gap-4 w-full justify-center ${isKerungExpanded && isTatopaniExpanded ? 'flex-row' : ''}`}>
                            {isKerungExpanded && (
                              <div className={`border rounded-lg p-3 ${isKerungExpanded && isTatopaniExpanded ? 'flex-1 max-w-xl' : 'w-full max-w-2xl'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold text-destructive text-sm">▸ KERUNG ({e.kerung.length} containers)</span>
                                  <div className="flex items-center gap-1 text-xs">
                                    <span>Total Containers:</span>
                                    <Input type="number" className="h-6 w-14 text-xs text-center" value={e.kerung.length} readOnly />
                                  </div>
                                </div>
                                {e.kerung.map((k, ki) => (
                                  <div key={ki} className="border rounded p-2 mb-2 bg-accent/10">
                                    <p className="font-bold text-xs mb-1">Container {ki + 1}</p>
                                    <div className="space-y-1.5">
                                      <div><label className="text-xs text-muted-foreground">Dispatched from Nylam</label><DebouncedInput className="h-7 text-xs" value={k.dispatchedFromNylam} onChange={(v) => { const nk = [...e.kerung]; nk[ki] = { ...nk[ki], dispatchedFromNylam: v }; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Loaded CTN</label><DebouncedInput type="number" className="h-7 text-xs" value={k.loadedCTN ?? ''} onChange={(v) => { const nk = [...e.kerung]; nk[ki] = { ...nk[ki], loadedCTN: v ? Number(v) : null }; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Nylam Container</label><DebouncedInput className="h-7 text-xs" value={k.nylamContainer} onChange={(v) => { const nk = [...e.kerung]; nk[ki] = { ...nk[ki], nylamContainer: v }; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Status</label>
                                        <select className="h-7 text-xs border rounded px-1 w-full bg-background" value={k.status} onChange={(ev) => { const nk = [...e.kerung]; nk[ki] = { ...nk[ki], status: ev.target.value as any }; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }}>
                                          <option value="">--</option>
                                          <option value="On the way to Kerung">On the way to Kerung</option>
                                          <option value="At Kerung port">At Kerung port</option>
                                        </select>
                                      </div>
                                      <div><label className="text-xs text-muted-foreground">Received CTN</label><DebouncedInput type="number" className="h-7 text-xs" value={k.receivedCTN ?? ''} onChange={(v) => { const nk = [...e.kerung]; nk[ki] = { ...nk[ki], receivedCTN: v ? Number(v) : null }; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Arrival Date</label><DebouncedInput type="date" delay={100} className="h-7 text-xs" value={k.arrivalDate} onChange={(v) => { const nk = [...e.kerung]; nk[ki] = { ...nk[ki], arrivalDate: v }; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }} /></div>
                                    </div>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { const nk = [...e.kerung, emptyKerung()]; store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }}>+ Add</Button>
                                  {e.kerung.length > 1 && <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { const nk = e.kerung.slice(0, -1); store.updateLoadingListEntry(e.id, origin, { kerung: nk }); }}>- Remove</Button>}
                                </div>
                              </div>
                            )}
                            {isTatopaniExpanded && (
                              <div className={`border rounded-lg p-3 ${isKerungExpanded && isTatopaniExpanded ? 'flex-1 max-w-xl' : 'w-full max-w-2xl'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold text-orange-700 text-sm">▸ TATOPANI ({e.tatopani.length} containers)</span>
                                  <div className="flex items-center gap-1 text-xs">
                                    <span>Total Containers:</span>
                                    <Input type="number" className="h-6 w-14 text-xs text-center" value={e.tatopani.length} readOnly />
                                  </div>
                                </div>
                                {e.tatopani.map((t, ti) => (
                                  <div key={ti} className="border rounded p-2 mb-2 bg-accent/10">
                                    <p className="font-bold text-xs mb-1">Container {ti + 1}</p>
                                    <div className="space-y-1.5">
                                      <div><label className="text-xs text-muted-foreground">Dispatched from Nylam</label><DebouncedInput className="h-7 text-xs" value={t.dispatchedFromNylam} onChange={(v) => { const nt = [...e.tatopani]; nt[ti] = { ...nt[ti], dispatchedFromNylam: v }; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Loaded CTN</label><DebouncedInput type="number" className="h-7 text-xs" value={t.loadedCTN ?? ''} onChange={(v) => { const nt = [...e.tatopani]; nt[ti] = { ...nt[ti], loadedCTN: v ? Number(v) : null }; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Nylam Container</label><DebouncedInput className="h-7 text-xs" value={t.nylamContainer} onChange={(v) => { const nt = [...e.tatopani]; nt[ti] = { ...nt[ti], nylamContainer: v }; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Status</label>
                                        <select className="h-7 text-xs border rounded px-1 w-full bg-background" value={t.status} onChange={(ev) => { const nt = [...e.tatopani]; nt[ti] = { ...nt[ti], status: ev.target.value as any }; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }}>
                                          <option value="">--</option>
                                          <option value="On the way to Tatopani">On the way to Tatopani</option>
                                          <option value="At Tatopani port">At Tatopani port</option>
                                        </select>
                                      </div>
                                      <div><label className="text-xs text-muted-foreground">Received CTN</label><DebouncedInput type="number" className="h-7 text-xs" value={t.receivedCTN ?? ''} onChange={(v) => { const nt = [...e.tatopani]; nt[ti] = { ...nt[ti], receivedCTN: v ? Number(v) : null }; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }} /></div>
                                      <div><label className="text-xs text-muted-foreground">Arrival Date</label><DebouncedInput type="date" delay={100} className="h-7 text-xs" value={t.arrivalDate} onChange={(v) => { const nt = [...e.tatopani]; nt[ti] = { ...nt[ti], arrivalDate: v }; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }} /></div>
                                    </div>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { const nt = [...e.tatopani, emptyTatopani()]; store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }}>+ Add</Button>
                                  {e.tatopani.length > 1 && <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { const nt = e.tatopani.slice(0, -1); store.updateLoadingListEntry(e.id, origin, { tatopani: nt }); }}>- Remove</Button>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={selectMode ? 31 : 30} className="p-8 text-center text-muted-foreground">No entries found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-bold">{editId ? 'Edit' : 'Add'} Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-medium">Date</label><Input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Consignment No.</label><Input value={form.consignmentNo || ''} onChange={(e) => setForm({ ...form, consignmentNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">MARKA</label><Input value={form.marka || ''} onChange={(e) => setForm({ ...form, marka: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Total CTNS</label><Input type="number" value={form.totalCTN || 0} onChange={(e) => setForm({ ...form, totalCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">CBM</label><Input type="number" step="0.01" value={form.cbm || 0} onChange={(e) => setForm({ ...form, cbm: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">GW</label><Input type="number" step="0.01" value={form.gw || 0} onChange={(e) => setForm({ ...form, gw: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">Destination</label><Select value={form.destination || 'TATOPANI'} onValueChange={(v) => setForm({ ...form, destination: v as Destination })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DESTINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs font-medium">LOT No.</label><Input value={form.lotNo || ''} onChange={(e) => setForm({ ...form, lotNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched from {cityName}</label><Input value={form.dispatchedFrom || ''} onChange={(e) => setForm({ ...form, dispatchedFrom: e.target.value })} /></div>
            <div><label className="text-xs font-medium">{cityName} Container</label><Input value={form.container || ''} onChange={(e) => setForm({ ...form, container: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Status</label><Select value={form.status || 'none'} onValueChange={(v) => setForm({ ...form, status: v === 'none' ? '' : v as ConsignmentStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">--</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs font-medium">Client</label><Input value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival at Nylam</label><Input type="date" value={form.arrivalDateNylam || ''} onChange={(e) => setForm({ ...form, arrivalDateNylam: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival at Lhasa</label><Input type="date" value={form.arrivalAtLhasa || ''} onChange={(e) => setForm({ ...form, arrivalAtLhasa: e.target.value })} /></div>
            <div className="col-span-2 text-xs text-muted-foreground italic">💡 Add Lhasa-Nylam Containers and Dispatched-from-Lhasa dates from the ▸ LHASA expandable column in the table after saving.</div>
            <div className="col-span-2"><label className="text-xs font-medium">Remarks</label><Input value={form.remarks || ''} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <Button className="mt-3 w-full" onClick={handleSave}>{editId ? 'Update' : 'Add'}</Button>
        </DialogContent>
      </Dialog>

      {/* View Dialog - status in top middle */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-[800px] max-h-[90vh] p-0">
          {viewItem && (
            <>
              <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{viewItem.consignmentNo}</h2>
                    <p className="text-sm font-bold opacity-90">{viewItem.marka} • {viewItem.origin === 'guangzhou' ? 'Guangzhou' : 'Yiwu'}</p>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <span className={`status-badge text-lg px-8 py-2 font-bold ${getStatusClass(viewItem.status)}`}>{viewItem.status || '-'}</span>
                </div>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📅 Date</span><span className="font-bold">{viewItem.date}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Consignment No.</span><span className="font-bold text-lg">{viewItem.consignmentNo}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">🏷️ MARKA</span><span className="font-bold text-lg">{viewItem.marka}</span></div>
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Total CTN</span><span className="text-xl font-bold">{viewItem.totalCTN}</span></div>
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Loaded CTNS</span><span className="text-xl font-bold">{viewItem.loadedCTNS ?? viewItem.totalCTN}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📐 CBM</span><span className="font-bold">{viewItem.cbm}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">⚖️ GW (KG)</span><span className="font-bold">{viewItem.gw}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📍 Destination</span><span className={`font-bold ${getDestinationClass(viewItem.destination)}`}>{viewItem.destination}</span></div>
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📋 LOT No.</span><span className="font-bold">{viewItem.lotNo || '-'}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">🚚 Dispatched from {cityName}</span><span className="font-bold">{viewItem.dispatchedFrom || '-'}</span></div>
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">🚢 {cityName} Container</span><span className="font-bold">{viewItem.container || '-'}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📅 Arrival at Nylam</span><span className="font-bold">{viewItem.arrivalDateNylam || '-'}</span></div>
                  {(() => {
                    const totalLhasaLoaded = (viewItem.lhasa || []).reduce((s, l) => s + (l.loadedCTN || 0), 0);
                    const recvNylam = viewItem.receivedCTNNylam ?? (totalLhasaLoaded > 0 ? totalLhasaLoaded : null);
                    return recvNylam != null ? (
                      <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Received CTN at Nylam</span><span className="text-xl font-bold">{recvNylam}</span></div>
                    ) : null;
                  })()}
                  <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">👤 Client</span><span className="font-bold text-lg">{viewItem.client || '-'}</span></div>
                  {viewItem.arrivalAtLhasa && (
                    <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📅 Arrival at Lhasa</span><span className="font-bold">{viewItem.arrivalAtLhasa}</span></div>
                  )}
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Received CTN at Lhasa</span><span className="text-xl font-bold">{viewItem.receivedCTNLhasa ?? viewItem.totalCTN}</span></div>
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">🔄 On the Way</span><span className="text-xl font-bold">{calcOnTheWay(viewItem) ?? '-'}</span></div>
                  <div className="border rounded p-2 bg-destructive/10"><span className="text-xs font-bold uppercase text-muted-foreground block">⚠️ Missing CTN</span><span className="text-xl font-bold">{calcMissing(viewItem) ?? '-'}</span></div>
                  {viewItem.remainingCTNLhasa != null && (
                    <div className="border rounded p-2 bg-warning/20 border-warning/30"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Remaining CTN at Lhasa</span><span className="text-xl font-bold">{viewItem.remainingCTNLhasa}</span></div>
                  )}
                  <div className="border rounded p-2 bg-primary/5"><span className="text-xs font-bold uppercase text-muted-foreground block">📦 Remaining CTN at Nylam</span><span className="text-xl font-bold">{calcRemainingAtNylam(viewItem) ?? '-'}</span></div>
                  <div className="border rounded p-2"><span className="text-xs font-bold uppercase text-muted-foreground block">✅ Follow Up</span><span className="font-bold">{viewItem.followUp ? '✅ Done' : '⬜ Pending'}</span></div>
                  <div className="border rounded p-2 col-span-2"><span className="text-xs font-bold uppercase text-muted-foreground block">📝 Remarks</span><span className="font-bold">{viewItem.remarks || '-'}</span></div>
                </div>

                {/* LHASA list - only if filled */}
                {(viewItem.lhasa?.length ?? 0) > 0 && (
                  <div className="border rounded-lg p-3">
                    <h4 className="font-bold text-sm mb-2 text-purple-700">🏔️ LHASA ({viewItem.lhasa.length} containers)</h4>
                    <div className="space-y-1.5">
                      {viewItem.lhasa.map((l, i) => (
                        <div key={i} className="border rounded p-2 bg-accent/20 grid grid-cols-3 gap-1.5 text-xs">
                          <div><span className="font-bold">Lhasa-Nylam Container:</span> <span className="font-bold">{l.nylamContainer || '-'}</span></div>
                          <div><span className="font-bold">Dispatched from Lhasa:</span> <span className="font-bold">{l.dispatchedFromLhasa || '-'}</span></div>
                          <div><span className="font-bold">Loaded CTN:</span> <span className="font-bold">{l.loadedCTN ?? '-'}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TATOPANI & KERUNG side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3">
                    <h4 className="font-bold text-sm mb-2">🔶 TATOPANI ({viewItem.tatopani.length} rows)</h4>
                    {viewItem.tatopani.map((t, i) => (
                      <div key={i} className="border rounded p-2 bg-accent/20 grid grid-cols-3 gap-1.5 text-xs mb-1.5">
                        <div><span className="font-bold">Dispatched:</span> <span className="font-bold">{t.dispatchedFromNylam || '-'}</span></div>
                        <div><span className="font-bold">Loaded:</span> <span className="font-bold">{t.loadedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Container:</span> <span className="font-bold">{t.nylamContainer || '-'}</span></div>
                        <div><span className="font-bold">Status:</span> <span className={`font-bold ${getStatusClass(t.status)}`}>{t.status || '-'}</span></div>
                        <div><span className="font-bold">Received:</span> <span className="font-bold">{t.receivedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Arrival at Tatopani:</span> <span className="font-bold">{t.arrivalDate || '-'}</span></div>
                      </div>
                    ))}
                  </div>
                  <div className="border rounded-lg p-3">
                    <h4 className="font-bold text-sm mb-2 text-destructive">🔴 KERUNG ({viewItem.kerung.length} rows)</h4>
                    {viewItem.kerung.map((k, i) => (
                      <div key={i} className="border rounded p-2 bg-destructive/5 grid grid-cols-3 gap-1.5 text-xs mb-1.5">
                        <div><span className="font-bold">Dispatched:</span> <span className="font-bold">{k.dispatchedFromNylam || '-'}</span></div>
                        <div><span className="font-bold">Loaded:</span> <span className="font-bold">{k.loadedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Container:</span> <span className="font-bold">{k.nylamContainer || '-'}</span></div>
                        <div><span className="font-bold">Status:</span> <span className={`font-bold ${getStatusClass(k.status)}`}>{k.status || '-'}</span></div>
                        <div><span className="font-bold">Received:</span> <span className="font-bold">{k.receivedCTN ?? '-'}</span></div>
                        <div><span className="font-bold">Arrival at Kerung:</span> <span className="font-bold">{k.arrivalDate || '-'}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OldNylamPage() {
  const { oldNylamGoods, addOldNylamEntry, updateOldNylamEntry, deleteOldNylamEntry } = useStore();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Partial<OldNylamEntry>>({
    date: new Date().toISOString().split('T')[0], consignmentNo: '', marka: '', totalCTN: 0, ctnRemainingNylam: 0,
    loadedCTN: 0, cbm: 0, gw: 0, destination: '', dispatchedFromNylam: '', nylamContainer: '',
    arrivalLocation: '', arrivalDate: '', client: '', followUp: false,
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOldNylamId, setViewOldNylamId] = useState<string | null>(null);
  const viewOldNylam = viewOldNylamId ? oldNylamGoods.find(e => e.id === viewOldNylamId) : null;

  const filtered = useMemo(() =>
    oldNylamGoods.filter(e => {
      const s = search.toLowerCase();
      return !s || e.consignmentNo.toLowerCase().includes(s) || e.marka.toLowerCase().includes(s) || e.client.toLowerCase().includes(s);
    }), [oldNylamGoods, search]);

  const handleSave = () => {
    if (editId) { updateOldNylamEntry(editId, form); setEditId(null); }
    else addOldNylamEntry(form as Omit<OldNylamEntry, 'id'>);
    setAddOpen(false);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(({ id, ...r }) => r));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Old Nylam');
    XLSX.writeFile(wb, 'old_nylam_goods.xlsx');
  };

  const toggleFollowUp = (id: string) => {
    const e = oldNylamGoods.find(x => x.id === id);
    if (e) updateOldNylamEntry(id, { followUp: !e.followUp });
  };

  const handleImport = (data: any[]) => {
    data.forEach((row) => {
      addOldNylamEntry({
        date: row['Date'] || row['date'] || '',
        consignmentNo: row['Consignment No.'] || row['consignmentNo'] || '',
        marka: row['MARKA'] || row['marka'] || '',
        totalCTN: Number(row['Total CTN'] || row['Total CTNS'] || row['totalCTN'] || 0),
        ctnRemainingNylam: Number(row['CTN Remaining Nylam'] || row['ctnRemainingNylam'] || 0),
        loadedCTN: Number(row['Loaded CTN'] || row['loadedCTN'] || 0),
        cbm: Number(row['CBM'] || row['cbm'] || 0),
        gw: Number(row['GW'] || row['gw'] || 0),
        destination: row['Destination'] || row['destination'] || '',
        dispatchedFromNylam: row['Dispatched from Nylam'] || row['dispatchedFromNylam'] || '',
        nylamContainer: row['Nylam Container'] || row['nylamContainer'] || '',
        arrivalLocation: row['Arrival Location'] || row['arrivalLocation'] || '',
        arrivalDate: row['Arrival Date'] || row['arrivalDate'] || '',
        client: row['Client'] || row['client'] || '',
        followUp: false,
        updatedAt: '',
      } as any);
    });
  };

  return (
    <div>
      <TableToolbar
        searchValue={search} onSearchChange={setSearch}
        onAdd={() => { setEditId(null); setForm({ date: new Date().toISOString().split('T')[0], consignmentNo: '', marka: '', totalCTN: 0, ctnRemainingNylam: 0, loadedCTN: 0, cbm: 0, gw: 0, destination: '', dispatchedFromNylam: '', nylamContainer: '', arrivalLocation: '', arrivalDate: '', client: '', followUp: false }); setAddOpen(true); }}
        onExport={handleExport}
        onImport={handleImport}
        onSelectToggle={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
        selectMode={selectMode}
        selectedCount={selected.size}
      />
      <div className="table-container border rounded-lg">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr>
              {selectMode && <th className="p-1.5 text-left">✓</th>}
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Date</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Consignment No.</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">MARKA</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">Total CTN</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">CTN Remaining</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap highlight-field">Loaded CTN</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">CBM</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">GW</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Destination</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Dispatched</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Container</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Arrival Location</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Arrival Date</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Client</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Follow Up</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Created By</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Updated By</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Last Modified</th>
              <th className="p-1.5 text-left font-bold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b hover:bg-accent/50">
                {selectMode && <td className="p-1.5"><input type="checkbox" checked={selected.has(e.id)} onChange={() => { const n = new Set(selected); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setSelected(n); }} /></td>}
                <td className="p-1.5 whitespace-nowrap font-bold">{e.date}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.consignmentNo}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.marka}</td>
                <td className="p-1.5 whitespace-nowrap highlight-field font-bold">{e.totalCTN}</td>
                <td className="p-1.5 whitespace-nowrap highlight-field font-bold">{e.ctnRemainingNylam}</td>
                <td className="p-1.5 whitespace-nowrap highlight-field font-bold">{e.loadedCTN}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.cbm}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.gw}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.destination}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.dispatchedFromNylam}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.nylamContainer}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.arrivalLocation}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.arrivalDate}</td>
                <td className="p-1.5 whitespace-nowrap font-bold">{e.client}</td>
                <td className="p-1.5 whitespace-nowrap text-center"><button onDoubleClick={() => toggleFollowUp(e.id)} className="p-1">{e.followUp ? <Check className="h-3.5 w-3.5 text-green-600" /> : '-'}</button></td>
                <td className="p-1.5 whitespace-nowrap text-xs text-muted-foreground">{(e as any).createdBy || '-'}</td>
                <td className="p-1.5 whitespace-nowrap text-xs text-muted-foreground">{(e as any).updatedBy || '-'}</td>
                <td className="p-1.5 whitespace-nowrap text-xs text-muted-foreground">{formatLastModified(e.updatedAt)}</td>
                <td className="p-1.5 whitespace-nowrap">
                  <div className="flex gap-0.5">
                    <button onClick={() => setViewOldNylamId(e.id)} className="p-0.5 hover:bg-accent rounded"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                    <button onClick={() => { setForm(e); setEditId(e.id); setAddOpen(true); }} className="p-0.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteOldNylamEntry(e.id)} className="p-0.5 hover:bg-accent rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!viewOldNylamId} onOpenChange={() => setViewOldNylamId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-bold">Old Nylam Goods - Details</DialogTitle></DialogHeader>
          {viewOldNylam && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
               <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Date</span>{viewOldNylam.date}</div>
                <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Consignment No.</span><span className="font-bold text-lg">{viewOldNylam.consignmentNo}</span></div>
                <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">MARKA</span><span className="font-bold text-lg">{viewOldNylam.marka}</span></div>
                <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Total CTN</span><span className="text-lg font-bold">{viewOldNylam.totalCTN}</span></div>
                <div className="bg-primary/10 rounded p-2 border border-primary/20"><span className="font-bold block text-xs text-muted-foreground">CTN Remaining at Nylam</span><span className="text-lg font-bold">{viewOldNylam.ctnRemainingNylam}</span></div>
                <div className="bg-primary/10 rounded p-2 border border-primary/20"><span className="font-bold block text-xs text-muted-foreground">Loaded CTN</span><span className="text-lg font-bold">{viewOldNylam.loadedCTN}</span></div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">CBM</span>{viewOldNylam.cbm}</div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">GW</span>{viewOldNylam.gw}</div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Destination</span>{viewOldNylam.destination}</div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Dispatched from Nylam</span>{viewOldNylam.dispatchedFromNylam}</div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Nylam Container</span>{viewOldNylam.nylamContainer}</div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Arrival Location</span>{viewOldNylam.arrivalLocation}</div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Arrival Date</span>{viewOldNylam.arrivalDate}</div>
                <div className="bg-warning/20 border border-warning/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Client</span><span className="font-bold text-lg">{viewOldNylam.client}</span></div>
                <div className="bg-accent/30 rounded p-2"><span className="font-bold block text-xs text-muted-foreground">Follow Up</span>{viewOldNylam.followUp ? '✅ Done' : '⬜ Pending'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-bold">{editId ? 'Edit' : 'Add'} Old Nylam Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-medium">Date</label><Input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Consignment No.</label><Input value={form.consignmentNo || ''} onChange={(e) => setForm({ ...form, consignmentNo: e.target.value })} /></div>
            <div><label className="text-xs font-medium">MARKA</label><Input value={form.marka || ''} onChange={(e) => setForm({ ...form, marka: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Total CTN</label><Input type="number" value={form.totalCTN || 0} onChange={(e) => setForm({ ...form, totalCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">CTN Remaining</label><Input type="number" value={form.ctnRemainingNylam || 0} onChange={(e) => setForm({ ...form, ctnRemainingNylam: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">Loaded CTN</label><Input type="number" value={form.loadedCTN || 0} onChange={(e) => setForm({ ...form, loadedCTN: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">CBM</label><Input type="number" step="0.01" value={form.cbm || 0} onChange={(e) => setForm({ ...form, cbm: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">GW</label><Input type="number" step="0.01" value={form.gw || 0} onChange={(e) => setForm({ ...form, gw: Number(e.target.value) })} /></div>
            <div><label className="text-xs font-medium">Destination</label><Input value={form.destination || ''} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Dispatched from Nylam</label><Input value={form.dispatchedFromNylam || ''} onChange={(e) => setForm({ ...form, dispatchedFromNylam: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Container</label><Input value={form.nylamContainer || ''} onChange={(e) => setForm({ ...form, nylamContainer: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival Location</label><Input value={form.arrivalLocation || ''} onChange={(e) => setForm({ ...form, arrivalLocation: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Arrival Date</label><Input type="date" value={form.arrivalDate || ''} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Client</label><Input value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
          </div>
          <Button className="mt-3 w-full" onClick={handleSave}>{editId ? 'Update' : 'Add'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoadingListsPage() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Loading Lists</h2>
      <Tabs defaultValue="guangzhou">
        <TabsList>
          <TabsTrigger value="guangzhou" className="font-bold">Guangzhou</TabsTrigger>
          <TabsTrigger value="yiwu" className="font-bold">Yiwu</TabsTrigger>
          <TabsTrigger value="oldnylam" className="font-bold">Old Nylam Goods</TabsTrigger>
        </TabsList>
        <TabsContent value="guangzhou"><LoadingListTable origin="guangzhou" /></TabsContent>
        <TabsContent value="yiwu"><LoadingListTable origin="yiwu" /></TabsContent>
        <TabsContent value="oldnylam"><OldNylamPage /></TabsContent>
      </Tabs>
    </div>
  );
}
