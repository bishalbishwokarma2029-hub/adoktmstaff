import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Trash2, Edit2, Save, Upload, X, FileSpreadsheet, StickyNote, Image, Download } from 'lucide-react';
import { toast } from 'sonner';

/* ───── helpers ───── */

interface ProfileMap { [userId: string]: string }

async function fetchProfiles(): Promise<ProfileMap> {
  const { data } = await supabase.from('profiles').select('user_id, display_name, email');
  const map: ProfileMap = {};
  (data ?? []).forEach((p: any) => { map[p.user_id] = p.display_name || p.email || 'Unknown'; });
  return map;
}

function userName(profiles: ProfileMap, id: string | null | undefined) {
  if (!id) return '—';
  return profiles[id] || 'Unknown';
}

/* ───── Recent Loading Lists Tab — stores files (any type) AS-IS ───── */

interface LoadingListEntry {
  id: string;
  title: string | null;
  data: any;
  file_url: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
}
function fileKindFromUrl(url: string): 'image' | 'pdf' | 'file' {
  if (isImageUrl(url)) return 'image';
  if (/\.pdf$/i.test(url)) return 'pdf';
  return 'file';
}

function RecentLoadingLists({ profiles }: { profiles: ProfileMap }) {
  const { user } = useAuth();
  const [lists, setLists] = useState<LoadingListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFileUrl, setEditFileUrl] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState<string>('');
  const [editHtml, setEditHtml] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchLists = useCallback(async () => {
    const { data } = await supabase
      .from('recent_loading_lists')
      .select('*')
      .order('created_at', { ascending: false });
    setLists((data ?? []).map((d: any) => ({
      ...d,
      data: d.data ?? null,
      file_url: d.file_url ?? null,
      updated_by: d.updated_by ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const uploadFileAsIs = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `loading-lists/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type || undefined });
      if (error) { toast.error('Upload failed'); return null; }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      return urlData.publicUrl;
    } catch { return null; }
  };

  const handleFile = async (file: File) => {
    const url = await uploadFileAsIs(file);
    if (!url) return;
    setEditTitle(file.name.replace(/\.\w+$/, ''));
    setEditFileName(file.name);
    setEditFileUrl(url);
    setEditHtml(null);
    setEditId(null);
    setShowDialog(true);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    // Prefer HTML (Excel/Sheets tables) so the data stays selectable text
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html && /<table/i.test(html)) {
      e.preventDefault();
      setEditTitle('Pasted Excel Data');
      setEditFileName('Pasted Excel Data');
      setEditFileUrl(null);
      setEditHtml(html);
      setEditId(null);
      setShowDialog(true);
      return;
    }
    if (text && text.includes('\t')) {
      e.preventDefault();
      // Convert TSV to HTML table (selectable)
      const rows = text.split(/\r?\n/).filter(r => r.length);
      const tableHtml = '<table border="1" cellspacing="0" cellpadding="4">' +
        rows.map(r => '<tr>' + r.split('\t').map(c => `<td>${c.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`).join('') + '</tr>').join('') +
        '</table>';
      setEditTitle('Pasted Excel Data');
      setEditFileName('Pasted Excel Data');
      setEditFileUrl(null);
      setEditHtml(tableHtml);
      setEditId(null);
      setShowDialog(true);
      return;
    }
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); await handleFile(file); return; }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const saveList = async () => {
    if (!editFileUrl && !editHtml) { toast.error('No file or pasted data'); return; }
    if (editId) {
      await supabase.from('recent_loading_lists').update({
        title: editTitle,
        file_url: editFileUrl,
        data: { fileName: editFileName, html: editHtml ?? undefined } as any,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      } as any).eq('id', editId);
      toast.success('Updated');
    } else {
      await supabase.from('recent_loading_lists').insert({
        title: editTitle,
        data: { fileName: editFileName, html: editHtml ?? undefined } as any,
        file_url: editFileUrl,
        created_by: user?.id,
        updated_by: user?.id,
      } as any);
      toast.success('Saved');
    }
    setShowDialog(false);
    fetchLists();
  };

  const deleteList = async (id: string) => {
    await supabase.from('recent_loading_lists').delete().eq('id', id);
    toast.success('Deleted');
    fetchLists();
  };

  const openEdit = (entry: LoadingListEntry) => {
    setEditId(entry.id);
    setEditTitle(entry.title ?? '');
    setEditFileUrl(entry.file_url);
    setEditFileName((entry.data as any)?.fileName ?? entry.title ?? '');
    setEditHtml((entry.data as any)?.html ?? null);
    setShowDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Upload File
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
        <span className="text-xs text-muted-foreground">or drag & drop / paste (Ctrl+V) any file (image, excel, pdf...)</span>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer focus:outline-none focus:border-primary/60"
      >
        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Drop any file here or paste it (image / excel / pdf / etc.) — saved as-is</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : lists.length === 0 ? <p className="text-sm text-muted-foreground">No loading lists yet.</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map(entry => {
            const url = entry.file_url;
            const kind = url ? fileKindFromUrl(url) : 'file';
            const html = (entry.data as any)?.html as string | undefined;
            return (
              <Card key={entry.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm truncate flex-1">{entry.title || 'Untitled'}</h4>
                  <div className="flex gap-1">
                    {url && (
                      <a href={url} download target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteList(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {url ? (
                  kind === 'image' ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={entry.title ?? ''} className="w-full max-h-64 object-contain rounded border bg-muted" />
                    </a>
                  ) : kind === 'pdf' ? (
                    <iframe src={url} className="w-full h-64 rounded border" title={entry.title ?? 'pdf'} />
                  ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 border rounded bg-muted hover:bg-accent">
                      <FileSpreadsheet className="h-5 w-5" />
                      <span className="text-xs truncate">{(entry.data as any)?.fileName || entry.title || 'Open file'}</span>
                    </a>
                  )
                ) : html ? (
                  <div
                    className="excel-paste max-h-64 overflow-auto rounded border bg-background p-2 text-xs select-text [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No file attached</p>
                )}
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  <p>Created by: <strong>{userName(profiles, entry.created_by)}</strong> — {new Date(entry.created_at).toLocaleString()}</p>
                  {entry.updated_by && entry.updated_by !== entry.created_by && (
                    <p>Updated by: <strong>{userName(profiles, entry.updated_by)}</strong> — {new Date(entry.updated_at).toLocaleString()}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg space-y-2">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit' : 'New'} Loading List</DialogTitle>
          </DialogHeader>
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
          {editFileUrl ? (
            isImageUrl(editFileUrl) ? (
              <img src={editFileUrl} alt="" className="w-full max-h-80 object-contain rounded border" />
            ) : (
              <a href={editFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 border rounded bg-muted">
                <FileSpreadsheet className="h-5 w-5" />
                <span className="text-xs truncate">{editFileName || 'Open file'}</span>
              </a>
            )
          ) : editHtml ? (
            <div
              className="excel-paste max-h-80 overflow-auto rounded border bg-background p-2 text-xs select-text [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted"
              dangerouslySetInnerHTML={{ __html: editHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No file selected.</p>
          )}
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Replace File
          </Button>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveList}><Save className="h-4 w-4 mr-1" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───── Notes Tab ───── */

interface NoteEntry {
  id: string;
  title: string;
  content: string;
  attachments: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function NotesTab({ profiles }: { profiles: ProfileMap }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from('important_notes')
      .select('*')
      .order('created_at', { ascending: false });
    setNotes((data ?? []).map((d: any) => ({
      ...d,
      attachments: Array.isArray(d.attachments) ? d.attachments : [],
      updated_by: d.updated_by ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop();
    const path = `notes/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file);
    if (error) { toast.error('Upload failed'); return; }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
    setEditAttachments(prev => [...prev, urlData.publicUrl]);
    toast.success('File attached');
  };

  const saveNote = async () => {
    if (!editTitle.trim() && !editContent.trim()) { toast.error('Enter title or content'); return; }
    if (editId) {
      await supabase.from('important_notes').update({
        title: editTitle,
        content: editContent,
        attachments: editAttachments as any,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      } as any).eq('id', editId);
      toast.success('Updated');
    } else {
      await supabase.from('important_notes').insert({
        title: editTitle,
        content: editContent,
        attachments: editAttachments as any,
        created_by: user?.id,
        updated_by: user?.id,
      } as any);
      toast.success('Saved');
    }
    setShowDialog(false);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await supabase.from('important_notes').delete().eq('id', id);
    toast.success('Deleted');
    fetchNotes();
  };

  const openEdit = (note: NoteEntry) => {
    setEditId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditAttachments(note.attachments);
    setShowDialog(true);
  };

  const openNew = () => {
    setEditId(null);
    setEditTitle('');
    setEditContent('');
    setEditAttachments([]);
    setShowDialog(true);
  };

  const removeAttachment = (idx: number) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Note</Button>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map(note => (
            <Card key={note.id} className="p-3">
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-semibold text-sm truncate flex-1">{note.title || 'Untitled'}</h4>
                <div className="flex gap-1 ml-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(note)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteNote(note.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
              {note.attachments.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {note.attachments.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      {/\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                        ? <img src={url} alt="" className="h-12 w-12 object-cover rounded border" />
                        : <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted"><Upload className="h-4 w-4" /></div>
                      }
                    </a>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                <p>Created by: <strong>{userName(profiles, note.created_by)}</strong> — {new Date(note.created_at).toLocaleString()}</p>
                {note.updated_by && note.updated_by !== note.created_by && (
                  <p>Updated by: <strong>{userName(profiles, note.updated_by)}</strong> — {new Date(note.updated_at).toLocaleString()}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit' : 'New'} Note</DialogTitle>
          </DialogHeader>
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
          <Textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            onPaste={async e => {
              const items = Array.from(e.clipboardData.items);
              for (const item of items) {
                if (item.kind === 'file') {
                  const file = item.getAsFile();
                  if (file) { e.preventDefault(); await handleFileUpload(file); return; }
                }
              }
            }}
            placeholder="Write your note... (you can also paste an image directly here)"
            rows={6}
          />
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Image className="h-4 w-4 mr-1" /> Attach File/Photo
            </Button>
            <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
            {editAttachments.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {editAttachments.map((url, i) => (
                  <div key={i} className="relative group">
                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                      ? <img src={url} alt="" className="h-16 w-16 object-cover rounded border" />
                      : <div className="h-16 w-16 rounded border flex items-center justify-center bg-muted text-xs">File</div>
                    }
                    <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveNote}><Save className="h-4 w-4 mr-1" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───── Main Page ───── */

export default function ImportantNotesPage() {
  const [profiles, setProfiles] = useState<ProfileMap>({});

  useEffect(() => {
    fetchProfiles().then(setProfiles);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <StickyNote className="h-5 w-5" /> Important Notes
      </h1>
      <Tabs defaultValue="recent-loading-lists">
        <TabsList>
          <TabsTrigger value="recent-loading-lists">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Recent Loading Lists
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-4 w-4 mr-1" /> Notes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="recent-loading-lists">
          <RecentLoadingLists profiles={profiles} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab profiles={profiles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
