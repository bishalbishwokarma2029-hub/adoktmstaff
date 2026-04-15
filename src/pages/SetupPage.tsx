import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import adoLogo from '@/assets/ado-logo.png';

export default function SetupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-lg text-center">
          <img src={adoLogo} alt="ADO" className="h-20 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-primary mb-2">Admin Account Created!</h1>
          <p className="text-sm text-muted-foreground mb-4">You are now the admin. Tell the developer to disable this page and re-enable signup protection.</p>
          <a href="/login" className="text-primary underline font-bold">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src={adoLogo} alt="ADO" className="h-20 mb-3" />
          <h1 className="text-xl font-bold">Initial Admin Setup</h1>
          <p className="text-sm text-muted-foreground">Create the first admin account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold mb-1 block">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Password (min 6 characters)</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            <UserPlus className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create Admin Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
