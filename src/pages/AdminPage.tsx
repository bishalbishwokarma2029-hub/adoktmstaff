import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Shield, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const db = supabase as any;

interface StaffMember {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

export default function AdminPage() {
  const { isAdmin, createStaffAccount, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchStaff = async () => {
    const { data: roles } = await db.from('user_roles').select('user_id, role, created_at');
    const { data: profiles } = await db.from('profiles').select('user_id, email, display_name');
    if (roles && profiles) {
      const members = roles.map((r: any) => {
        const p = profiles.find((p: any) => p.user_id === r.user_id);
        return {
          user_id: r.user_id,
          email: p?.email || '',
          display_name: p?.display_name || '',
          role: r.role,
          created_at: r.created_at,
        };
      });
      setStaff(members);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchStaff();
  }, [isAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);
    const { error } = await createStaffAccount(email, password, displayName || email);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Staff account created!');
      setEmail('');
      setPassword('');
      setDisplayName('');
      fetchStaff();
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string, staffEmail: string) => {
    if (!confirm(`Are you sure you want to delete staff "${staffEmail}"? They will no longer be able to login.`)) return;
    setDeleting(userId);
    try {
      const { data, error } = await supabase.functions.invoke('delete-staff', {
        body: { user_id: userId },
      });
      if (error) {
        toast.error(error.message);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Staff "${staffEmail}" deleted successfully`);
        fetchStaff();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete staff');
    }
    setDeleting(null);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5" /> Admin Panel</h2>
        <p className="text-sm text-muted-foreground font-medium">Manage staff accounts</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h3 className="font-bold mb-4 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Create Staff Account</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <Button type="submit" disabled={creating}>
            <UserPlus className="h-4 w-4 mr-2" />
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Staff Members ({staff.length})</h3>
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.user_id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="font-bold">{s.display_name || s.email}</span>
                <span className="text-sm text-muted-foreground ml-2">({s.email})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded ${s.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {s.role.toUpperCase()}
                </span>
                {s.user_id !== user?.id && (
                  <button
                    onClick={() => handleDelete(s.user_id, s.email)}
                    disabled={deleting === s.user_id}
                    className="p-1 hover:bg-destructive/10 rounded"
                    title="Delete staff"
                  >
                    <Trash2 className={`h-4 w-4 text-destructive ${deleting === s.user_id ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
