import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (loading) return null;
  if (user) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast({ title: 'Erro ao entrar', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md gradient-card border-border/50">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Painel Administrativo</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Acesse para gerenciar resultados</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
