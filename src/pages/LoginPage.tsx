import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import adoLogo from '@/assets/ado-logo.png';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card border rounded-2xl shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src={adoLogo} alt="ADO International" className="h-24 mb-3" />
          <h1 className="text-xl font-bold">ADO International Transport</h1>
          <p className="text-sm text-muted-foreground font-medium">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold mb-1 block">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Enter your email" />
          </div>
          <div>
            <label className="text-sm font-bold mb-1 block">Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password" />
          </div>
          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            <Lock className="h-4 w-4 mr-2" />
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Contact admin for access credentials
        </p>
      </div>
    </div>
  );
}
