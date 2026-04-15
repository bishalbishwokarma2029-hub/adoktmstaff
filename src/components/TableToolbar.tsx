import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Upload, Download, CheckSquare, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAdd: () => void;
  onExport: () => void;
  onImport: (data: any[]) => void;
  onSelectToggle: () => void;
  selectMode: boolean;
  selectedCount?: number;
  masterEditContent?: React.ReactNode;
  extraButtons?: React.ReactNode;
  addLabel?: string;
}

export default function TableToolbar({
  searchValue, onSearchChange, onAdd, onExport, onImport,
  onSelectToggle, selectMode, selectedCount = 0,
  masterEditContent, extraButtons, addLabel = 'Add New'
}: TableToolbarProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [masterEditOpen, setMasterEditOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      onImport(json);
      setImportOpen(false);
    };
    reader.readAsArrayBuffer(file);
  }, [onImport]);

  const handlePaste = useCallback(() => {
    if (!pasteData.trim()) return;
    const lines = pasteData.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map(line => {
      const vals = line.split('\t');
      const obj: any = {};
      headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim() || ''; });
      return obj;
    });
    onImport(rows);
    setPasteData('');
    setImportOpen(false);
  }, [pasteData, onImport]);

  const [fieldMapOpen, setFieldMapOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const handlePreviewImport = useCallback((data: any[]) => {
    if (data.length === 0) return;
    setPreviewData(data);
    // Auto-detect field mapping from headers
    const headers = Object.keys(data[0]);
    const mapping: Record<string, string> = {};
    headers.forEach(h => { mapping[h] = h; });
    setFieldMapping(mapping);
    setFieldMapOpen(true);
  }, []);

  const handleFileWithPreview = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      handlePreviewImport(json);
      setImportOpen(false);
    };
    reader.readAsArrayBuffer(file);
  }, [handlePreviewImport]);

  const handlePasteWithPreview = useCallback(() => {
    if (!pasteData.trim()) return;
    const lines = pasteData.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map(line => {
      const vals = line.split('\t');
      const obj: any = {};
      headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim() || ''; });
      return obj;
    });
    handlePreviewImport(rows);
    setPasteData('');
    setImportOpen(false);
  }, [pasteData, handlePreviewImport]);

  const confirmImport = useCallback(() => {
    onImport(previewData);
    setFieldMapOpen(false);
    setPreviewData([]);
  }, [previewData, onImport]);

  return (
    <>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm"><Upload className="h-3.5 w-3.5 mr-1" />Import</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-bold">Smart Import</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Upload Excel File</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileWithPreview} className="block w-full text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Or Paste Excel Data</label>
              <Textarea
                placeholder="Paste tab-separated data here (with headers)..."
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                rows={6}
              />
              <Button size="sm" className="mt-2" onClick={handlePasteWithPreview}>Import Pasted Data</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="outline" size="sm" onClick={onExport}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
      <Button size="sm" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" />{addLabel}</Button>
      <Button variant={selectMode ? "secondary" : "outline"} size="sm" onClick={onSelectToggle}>
        <CheckSquare className="h-3.5 w-3.5 mr-1" />{selectMode ? `Selected (${selectedCount})` : 'Select'}
      </Button>

      {masterEditContent && selectMode && selectedCount > 0 && (
        <Dialog open={masterEditOpen} onOpenChange={setMasterEditOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm"><Edit className="h-3.5 w-3.5 mr-1" />Master Edit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-bold">Master Edit ({selectedCount} items)</DialogTitle></DialogHeader>
            {masterEditContent}
          </DialogContent>
        </Dialog>
      )}

      {extraButtons}
    </div>

    {/* Import Preview Dialog */}
    <Dialog open={fieldMapOpen} onOpenChange={setFieldMapOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-bold">Import Preview ({previewData.length} rows)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Preview of data to be imported. Click "Confirm Import" to proceed.</p>
          {previewData.length > 0 && (
            <div className="border rounded overflow-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>{Object.keys(previewData[0]).map(h => <th key={h} className="p-1.5 text-left font-bold whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b">
                      {Object.values(row).map((v, j) => <td key={j} className="p-1.5 whitespace-nowrap">{String(v ?? '')}</td>)}
                    </tr>
                  ))}
                  {previewData.length > 20 && <tr><td colSpan={Object.keys(previewData[0]).length} className="p-2 text-center text-muted-foreground">...and {previewData.length - 20} more rows</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setFieldMapOpen(false)}>Cancel</Button>
            <Button onClick={confirmImport}>Confirm Import ({previewData.length} rows)</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
