import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DRAW_TIMES, DRAW_TIME_LABELS, BICHOS, getTodayDateString } from '@/lib/bichos';
import { useTodayResults } from '@/hooks/useResults';
import { useSponsors } from '@/hooks/useSponsors';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Trophy, LogOut, Plus, Home, Image, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type DrawTime = Database['public']['Enums']['draw_time'];

function getBichoFromMillhar(milhar: string) {
  const dezena = milhar.slice(-2);
  const bicho = BICHOS.find(b => (b.dezenas as readonly string[]).includes(dezena));
  return bicho ? { group: bicho.group, name: bicho.name } : { group: 1, name: 'Avestruz' };
}

function ResultsTab() {
  const { user } = useAuth();
  const { data: todayResults } = useTodayResults();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [drawDate, setDrawDate] = useState(getTodayDateString());
  const [drawTime, setDrawTime] = useState<DrawTime>('10h');
  const [milhares, setMilhares] = useState(['', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);

  const updateMilhar = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    const next = [...milhares];
    next[index] = cleaned;
    setMilhares(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (milhares.some(m => m.length !== 4)) {
      toast({ title: 'Erro', description: 'Todas as milhares devem ter 4 dígitos', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const prizes = milhares.map(m => {
        const { group, name } = getBichoFromMillhar(m);
        return { milhar: m, group, bicho: name };
      });
      const { error } = await supabase.from('draw_results').insert({
        draw_date: drawDate, draw_time: drawTime,
        prize_1_milhar: prizes[0].milhar, prize_1_group: prizes[0].group, prize_1_bicho: prizes[0].bicho,
        prize_2_milhar: prizes[1].milhar, prize_2_group: prizes[1].group, prize_2_bicho: prizes[1].bicho,
        prize_3_milhar: prizes[2].milhar, prize_3_group: prizes[2].group, prize_3_bicho: prizes[2].bicho,
        prize_4_milhar: prizes[3].milhar, prize_4_group: prizes[3].group, prize_4_bicho: prizes[3].bicho,
        prize_5_milhar: prizes[4].milhar, prize_5_group: prizes[4].group, prize_5_bicho: prizes[4].bicho,
        created_by: user!.id,
      });
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Resultado publicado!' });
      setMilhares(['', '', '', '', '']);
      queryClient.invalidateQueries({ queryKey: ['draw_results'] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Cadastrar Resultado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Data</label>
                <Input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário</label>
                <Select value={drawTime} onValueChange={v => setDrawTime(v as DrawTime)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DRAW_TIMES.map(t => (
                      <SelectItem key={t} value={t}>PT-Rio {DRAW_TIME_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground">Milhares (5 prêmios)</label>
              {milhares.map((m, i) => {
                const preview = m.length === 4 ? getBichoFromMillhar(m) : null;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-20">{i + 1}° Prêmio</span>
                    <Input placeholder="0000" value={m} onChange={e => updateMilhar(i, e.target.value)}
                      className="font-mono text-lg tracking-widest max-w-32" maxLength={4} />
                    {preview && (
                      <span className="text-sm text-muted-foreground">
                        {BICHOS.find(b => b.group === preview.group)?.emoji} G{String(preview.group).padStart(2, '0')} - {preview.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Publicando...' : 'Publicar Resultado'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="font-display text-lg font-bold">Resultados de Hoje</h3>
      {todayResults && todayResults.length > 0 ? (
        <div className="space-y-3">
          {todayResults.map(r => (
            <Card key={r.id} className="gradient-card border-border/50">
              <CardContent className="py-4 flex items-center justify-between">
                <span className="font-display font-bold">PT-Rio {DRAW_TIME_LABELS[r.draw_time]}</span>
                <span className="text-sm text-primary">
                  {r.prize_1_milhar} • {r.prize_2_milhar} • {r.prize_3_milhar} • {r.prize_4_milhar} • {r.prize_5_milhar}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum resultado publicado hoje.</p>
      )}
    </div>
  );
}

function SponsorsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: allSponsors } = useQuery({
    queryKey: ['sponsors', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sponsors').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [position, setPosition] = useState('sidebar');
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !imageUrl) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('sponsors').insert({
        name, image_url: imageUrl, link_url: linkUrl || null,
        position, created_by: user!.id,
      });
      if (error) throw error;
      toast({ title: 'Patrocinador adicionado!' });
      setName(''); setImageUrl(''); setLinkUrl('');
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" /> Adicionar Patrocinador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <Input placeholder="Nome do patrocinador" value={name} onChange={e => setName(e.target.value)} required />
            <Input placeholder="URL da imagem do banner" value={imageUrl} onChange={e => setImageUrl(e.target.value)} required />
            <Input placeholder="URL de destino (opcional)" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Topo do Site</SelectItem>
                <SelectItem value="sidebar">Barra Lateral</SelectItem>
                <SelectItem value="between_results">Entre Resultados</SelectItem>
                <SelectItem value="footer">Rodapé</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="font-display text-lg font-bold">Patrocinadores Cadastrados</h3>
      {allSponsors && allSponsors.length > 0 ? (
        <div className="space-y-3">
          {allSponsors.map(s => (
            <Card key={s.id} className="gradient-card border-border/50">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.position} • {s.is_active ? 'Ativo' : 'Inativo'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum patrocinador cadastrado.</p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, loading, isAdmin, signOut } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="font-display text-xl font-bold">Painel Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="sm"><Home className="h-4 w-4 mr-1" /> Site</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {!isAdmin && (
          <Card className="gradient-card border-accent/30 mb-6">
            <CardContent className="py-4 text-center text-accent">
              ⚠️ Sua conta não possui permissão de administrador.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="results">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="results" className="flex-1">Resultados</TabsTrigger>
            <TabsTrigger value="sponsors" className="flex-1">Patrocinadores</TabsTrigger>
          </TabsList>
          <TabsContent value="results"><ResultsTab /></TabsContent>
          <TabsContent value="sponsors"><SponsorsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
