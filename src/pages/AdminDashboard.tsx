import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DRAW_TIMES, DRAW_TIME_LABELS, BICHOS, getTodayDateString } from '@/lib/bichos';
import { CAPITAL_DRAW_TIMES, CAPITAL_DRAW_TIME_LABELS } from '@/lib/capital';
import { useTodayResults, type DrawResult } from '@/hooks/useResults';
import { useLatestFederalResult, type FederalResult } from '@/hooks/useFederalResults';
import { useTodayCapitalResults, type CapitalResult } from '@/hooks/useCapitalResults';
import { useSponsors } from '@/hooks/useSponsors';
import { useTicker, useUpdateTicker } from '@/hooks/useTicker';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Trophy, LogOut, Plus, ArrowLeft, Image, Trash2, Upload, RefreshCw, Loader2, Pencil, X, Check, MapPin, Type } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type DrawTime = Database['public']['Enums']['draw_time'];

function getBichoFromMillhar(milhar: string) {
  const dezena = milhar.slice(-2);
  const bicho = BICHOS.find(b => (b.dezenas as readonly string[]).includes(dezena));
  return bicho ? { group: bicho.group, name: bicho.name } : { group: 1, name: 'Avestruz' };
}

// Generic editable card for both PT-Rio and Capital
function EditableResultCard({ result, tableName, labelPrefix, labelsMap, queryKey }: {
  result: DrawResult | CapitalResult;
  tableName: 'draw_results' | 'capital_results';
  labelPrefix: string;
  labelsMap: Record<string, string>;
  queryKey: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [milhares, setMilhares] = useState([
    result.prize_1_milhar, result.prize_2_milhar, result.prize_3_milhar,
    result.prize_4_milhar, result.prize_5_milhar,
  ]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const label = `${labelPrefix} ${labelsMap[result.draw_time] || result.draw_time}`;

  const handleSave = async () => {
    if (milhares.some(m => m.length !== 4)) {
      toast({ title: 'Erro', description: 'Todas as milhares devem ter 4 dígitos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const prizes = milhares.map(m => {
        const { group, name } = getBichoFromMillhar(m);
        return { milhar: m, group, bicho: name };
      });

      const { error } = await supabase.from(tableName).update({
        prize_1_milhar: prizes[0].milhar, prize_1_group: prizes[0].group, prize_1_bicho: prizes[0].bicho,
        prize_2_milhar: prizes[1].milhar, prize_2_group: prizes[1].group, prize_2_bicho: prizes[1].bicho,
        prize_3_milhar: prizes[2].milhar, prize_3_group: prizes[2].group, prize_3_bicho: prizes[2].bicho,
        prize_4_milhar: prizes[3].milhar, prize_4_group: prizes[3].group, prize_4_bicho: prizes[3].bicho,
        prize_5_milhar: prizes[4].milhar, prize_5_group: prizes[4].group, prize_5_bicho: prizes[4].bicho,
        status: result.status,
        updated_at: new Date().toISOString(),
      } as any).eq('id', result.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: '✅ Atualizado', description: `${label} atualizado!` });
      setEditing(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { error } = await supabase.from(tableName).update({
        status: 'confirmed', updated_at: new Date().toISOString(),
      } as any).eq('id', result.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: '✅ Publicado', description: `${label} disponível na tela principal.` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', result.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: '🗑️ Removido', description: `${label} removido.` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <Card className="gradient-card border-primary/30">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold">{label}</span>
            <Button variant="ghost" size="icon" onClick={() => {
              setEditing(false);
              setMilhares([result.prize_1_milhar, result.prize_2_milhar, result.prize_3_milhar, result.prize_4_milhar, result.prize_5_milhar]);
            }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {milhares.map((m, i) => {
            const preview = m.length === 4 ? getBichoFromMillhar(m) : null;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">{i + 1}° Prêmio</span>
                <Input
                  value={m}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    const next = [...milhares];
                    next[i] = v;
                    setMilhares(next);
                  }}
                  className="font-mono text-lg tracking-widest max-w-28"
                  maxLength={4}
                  placeholder="0000"
                />
                {preview && (
                  <span className="text-xs text-muted-foreground">
                    {BICHOS.find(b => b.group === preview.group)?.emoji} G{String(preview.group).padStart(2, '0')}
                  </span>
                )}
              </div>
            );
          })}
          <Button onClick={handleSave} disabled={saving || milhares.some(m => m.length !== 4)} className="w-full" size="sm">
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</> : <><Check className="h-4 w-4 mr-1" /> Salvar Alterações</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gradient-card border-border/50">
      <CardContent className="py-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold">{label}</span>
            <Badge variant={result.status === 'confirmed' ? 'default' : 'secondary'}>
              {result.status === 'confirmed' ? 'Publicado' : 'Rascunho'}
            </Badge>
          </div>
          <p className="text-sm text-primary">
            {result.prize_1_milhar} • {result.prize_2_milhar} • {result.prize_3_milhar} • {result.prize_4_milhar} • {result.prize_5_milhar}
          </p>
        </div>
        <div className="flex gap-1">
          {result.status !== 'confirmed' && (
            <Button variant="ghost" size="icon" onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-primary" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resultado?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir {label}? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ===================== PT-Rio Results Tab =====================

function PTRioResultsSection() {
  const { user } = useAuth();
  const { data: todayResults } = useTodayResults();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [drawDate, setDrawDate] = useState(getTodayDateString());
  const [drawTime, setDrawTime] = useState<DrawTime>('PPT');
  const [milhares, setMilhares] = useState(['', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [savedPrizes, setSavedPrizes] = useState<number[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const existing = todayResults?.find(r => r.draw_date === drawDate && r.draw_time === drawTime);
    if (existing) {
      setMilhares([existing.prize_1_milhar, existing.prize_2_milhar, existing.prize_3_milhar, existing.prize_4_milhar, existing.prize_5_milhar]);
      setSavedPrizes([0, 1, 2, 3, 4]);
      setIsEditing(true);
    } else {
      setMilhares(['', '', '', '', '']);
      setSavedPrizes([]);
      setIsEditing(false);
    }
  }, [drawDate, drawTime, todayResults]);

  useEffect(() => {
    if (isEditing) return;
    const firstEmpty = milhares.findIndex(m => m.length < 4);
    if (firstEmpty >= 0) inputRefs.current[firstEmpty]?.focus();
  }, [drawTime]);

  const submitResult = useCallback(async (finalMilhares: string[]) => {
    if (finalMilhares.some(m => m.length !== 4) || !user) return;
    setSubmitting(true);
    try {
      const prizes = finalMilhares.map(m => {
        const { group, name } = getBichoFromMillhar(m);
        return { milhar: m, group, bicho: name };
      });

      const { data: existing } = await supabase.from('draw_results').select('status').eq('draw_date', drawDate).eq('draw_time', drawTime).maybeSingle();
      const nextStatus = existing?.status === 'confirmed' ? 'confirmed' : 'confirmed';

      const { error } = await supabase.from('draw_results').upsert({
        draw_date: drawDate, draw_time: drawTime,
        prize_1_milhar: prizes[0].milhar, prize_1_group: prizes[0].group, prize_1_bicho: prizes[0].bicho,
        prize_2_milhar: prizes[1].milhar, prize_2_group: prizes[1].group, prize_2_bicho: prizes[1].bicho,
        prize_3_milhar: prizes[2].milhar, prize_3_group: prizes[2].group, prize_3_bicho: prizes[2].bicho,
        prize_4_milhar: prizes[3].milhar, prize_4_group: prizes[3].group, prize_4_bicho: prizes[3].bicho,
        prize_5_milhar: prizes[4].milhar, prize_5_group: prizes[4].group, prize_5_bicho: prizes[4].bicho,
        created_by: user.id, status: nextStatus, updated_at: new Date().toISOString(),
      }, { onConflict: 'draw_date,draw_time' });

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['draw_results'] });
      toast({ title: '✅ Publicado', description: `PT-Rio ${DRAW_TIME_LABELS[drawTime]} salvo!` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }, [drawDate, drawTime, user, queryClient, toast]);

  const updateMilhar = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    const next = [...milhares]; next[index] = cleaned; setMilhares(next);
    setIsEditing(true);
    if (cleaned.length === 4) {
      setSavedPrizes(prev => (prev.includes(index) ? prev : [...prev, index]));
      if (index < 4) setTimeout(() => inputRefs.current[index + 1]?.focus(), 50);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> PT-Rio — Cadastrar Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); submitResult(milhares); }} className="space-y-6">
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
                    {DRAW_TIMES.map(t => {
                      const r = todayResults?.find(r => r.draw_time === t && r.draw_date === drawDate);
                      return <SelectItem key={t} value={t}>PT-Rio {DRAW_TIME_LABELS[t]} {r?.status === 'confirmed' ? '✅' : r ? '📝' : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground">Milhares (5 prêmios)</label>
              {milhares.map((m, i) => {
                const preview = m.length === 4 ? getBichoFromMillhar(m) : null;
                const isSaved = savedPrizes.includes(i);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-20">{i + 1}° Prêmio</span>
                    <Input ref={el => { inputRefs.current[i] = el; }} placeholder="0000" value={m} onChange={e => updateMilhar(i, e.target.value)}
                      className={`font-mono text-lg tracking-widest max-w-32 ${isSaved ? 'border-primary/50 bg-primary/5' : ''}`} maxLength={4} />
                    {preview && <span className="text-sm text-muted-foreground">{BICHOS.find(b => b.group === preview.group)?.emoji} G{String(preview.group).padStart(2, '0')} - {preview.name}</span>}
                    {isSaved && <span className="text-primary text-xs">✓</span>}
                  </div>
                );
              })}
            </div>
            <Button type="submit" className="w-full" disabled={submitting || milhares.some(m => m.length !== 4)}>
              {submitting ? 'Salvando...' : isEditing ? 'Atualizar e publicar' : 'Salvar e publicar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ScrapeSection functionName="scrape-results" drawTimes={DRAW_TIMES as unknown as string[]} labelsMap={DRAW_TIME_LABELS} queryKey="draw_results" title="PT-Rio" />

      <h3 className="font-display text-lg font-bold">PT-Rio — Resultados de Hoje</h3>
      {todayResults && todayResults.length > 0 ? (
        <div className="space-y-3">
          {todayResults.map(r => (
            <EditableResultCard key={r.id} result={r} tableName="draw_results" labelPrefix="PT-Rio" labelsMap={DRAW_TIME_LABELS} queryKey="draw_results" />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum resultado PT-Rio publicado hoje.</p>
      )}
    </div>
  );
}

// ===================== Capital Results Section =====================

function CapitalResultsSection() {
  const { user } = useAuth();
  const { data: todayCapital } = useTodayCapitalResults();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [drawDate, setDrawDate] = useState(getTodayDateString());
  const [drawTime, setDrawTime] = useState<string>(CAPITAL_DRAW_TIMES[0]);
  const [milhares, setMilhares] = useState(['', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [savedPrizes, setSavedPrizes] = useState<number[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const existing = todayCapital?.find(r => r.draw_date === drawDate && r.draw_time === drawTime);
    if (existing) {
      setMilhares([existing.prize_1_milhar, existing.prize_2_milhar, existing.prize_3_milhar, existing.prize_4_milhar, existing.prize_5_milhar]);
      setSavedPrizes([0, 1, 2, 3, 4]);
      setIsEditing(true);
    } else {
      setMilhares(['', '', '', '', '']);
      setSavedPrizes([]);
      setIsEditing(false);
    }
  }, [drawDate, drawTime, todayCapital]);

  useEffect(() => {
    if (isEditing) return;
    const firstEmpty = milhares.findIndex(m => m.length < 4);
    if (firstEmpty >= 0) inputRefs.current[firstEmpty]?.focus();
  }, [drawTime]);

  const submitResult = useCallback(async (finalMilhares: string[]) => {
    if (finalMilhares.some(m => m.length !== 4) || !user) return;
    setSubmitting(true);
    try {
      const prizes = finalMilhares.map(m => {
        const { group, name } = getBichoFromMillhar(m);
        return { milhar: m, group, bicho: name };
      });

      const { error } = await supabase.from('capital_results').upsert({
        draw_date: drawDate, draw_time: drawTime,
        prize_1_milhar: prizes[0].milhar, prize_1_group: prizes[0].group, prize_1_bicho: prizes[0].bicho,
        prize_2_milhar: prizes[1].milhar, prize_2_group: prizes[1].group, prize_2_bicho: prizes[1].bicho,
        prize_3_milhar: prizes[2].milhar, prize_3_group: prizes[2].group, prize_3_bicho: prizes[2].bicho,
        prize_4_milhar: prizes[3].milhar, prize_4_group: prizes[3].group, prize_4_bicho: prizes[3].bicho,
        prize_5_milhar: prizes[4].milhar, prize_5_group: prizes[4].group, prize_5_bicho: prizes[4].bicho,
        created_by: user.id, status: 'confirmed', updated_at: new Date().toISOString(),
      } as any, { onConflict: 'draw_date,draw_time' });

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['capital_results'] });
      toast({ title: '✅ Publicado', description: `Capital ${CAPITAL_DRAW_TIME_LABELS[drawTime]} salvo!` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }, [drawDate, drawTime, user, queryClient, toast]);

  const updateMilhar = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    const next = [...milhares]; next[index] = cleaned; setMilhares(next);
    setIsEditing(true);
    if (cleaned.length === 4) {
      setSavedPrizes(prev => (prev.includes(index) ? prev : [...prev, index]));
      if (index < 4) setTimeout(() => inputRefs.current[index + 1]?.focus(), 50);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" /> Capital — Cadastrar Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); submitResult(milhares); }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Data</label>
                <Input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Horário</label>
                <Select value={drawTime} onValueChange={setDrawTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAPITAL_DRAW_TIMES.map(t => {
                      const r = todayCapital?.find(r => r.draw_time === t && r.draw_date === drawDate);
                      return <SelectItem key={t} value={t}>Capital {CAPITAL_DRAW_TIME_LABELS[t]} {r?.status === 'confirmed' ? '✅' : r ? '📝' : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground">Milhares (5 prêmios)</label>
              {milhares.map((m, i) => {
                const preview = m.length === 4 ? getBichoFromMillhar(m) : null;
                const isSaved = savedPrizes.includes(i);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-20">{i + 1}° Prêmio</span>
                    <Input ref={el => { inputRefs.current[i] = el; }} placeholder="0000" value={m} onChange={e => updateMilhar(i, e.target.value)}
                      className={`font-mono text-lg tracking-widest max-w-32 ${isSaved ? 'border-accent/50 bg-accent/5' : ''}`} maxLength={4} />
                    {preview && <span className="text-sm text-muted-foreground">{BICHOS.find(b => b.group === preview.group)?.emoji} G{String(preview.group).padStart(2, '0')} - {preview.name}</span>}
                    {isSaved && <span className="text-accent text-xs">✓</span>}
                  </div>
                );
              })}
            </div>
            <Button type="submit" className="w-full" disabled={submitting || milhares.some(m => m.length !== 4)}>
              {submitting ? 'Salvando...' : isEditing ? 'Atualizar e publicar' : 'Salvar e publicar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ScrapeSection functionName="scrape-capital" drawTimes={CAPITAL_DRAW_TIMES as unknown as string[]} labelsMap={CAPITAL_DRAW_TIME_LABELS} queryKey="capital_results" title="Capital" />

      <h3 className="font-display text-lg font-bold">Capital — Resultados de Hoje</h3>
      {todayCapital && todayCapital.length > 0 ? (
        <div className="space-y-3">
          {todayCapital.map(r => (
            <EditableResultCard key={r.id} result={r} tableName="capital_results" labelPrefix="Capital" labelsMap={CAPITAL_DRAW_TIME_LABELS} queryKey="capital_results" />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum resultado Capital publicado hoje.</p>
      )}
    </div>
  );
}

// ===================== Scrape Section (generic) =====================

function ScrapeSection({ functionName, drawTimes, labelsMap, queryKey, title }: {
  functionName: string; drawTimes: string[]; labelsMap: Record<string, string>; queryKey: string; title: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingTime, setLoadingTime] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'all' | 'single'; time?: string } | null>(null);

  // Query last sync time per draw_time
  const tableName = queryKey === 'draw_results' ? 'draw_results' : 'capital_results';
  const { data: lastSyncData } = useQuery({
    queryKey: [queryKey, 'last-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select('draw_time, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      // Build map of draw_time -> latest updated_at
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.draw_time] || r.updated_at > map[r.draw_time]) {
          map[r.draw_time] = r.updated_at;
        }
      });
      return map;
    },
    refetchInterval: 60000,
  });

  const formatSyncTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Overall last sync
  const overallLastSync = lastSyncData
    ? Object.values(lastSyncData).sort().reverse()[0]
    : null;

  const invokeScrape = async (drawTime?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: drawTime ? { draw_time: drawTime } : {},
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      await queryClient.refetchQueries({ queryKey: [queryKey, 'today'] });
      await queryClient.refetchQueries({ queryKey: [queryKey, 'last-sync'] });
      toast({
        title: `Scrape ${title} concluído`,
        description: `Inseridos: ${data?.inserted || 0} | Atualizados: ${data?.updated || 0}`,
      });
    } catch (err: any) {
      toast({ title: 'Erro no scrape', description: err.message, variant: 'destructive' });
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'all') {
      setLoadingAll(true);
      await invokeScrape();
      setLoadingAll(false);
    } else {
      setLoadingTime(confirmAction.time!);
      await invokeScrape(confirmAction.time);
      setLoadingTime(null);
    }
    setConfirmAction(null);
  };

  return (
    <>
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" /> Atualizar {title} (Scrape)
          </CardTitle>
          {overallLastSync && (
            <p className="text-xs text-muted-foreground mt-1">
              Última sincronização geral: <span className="text-primary font-medium">{formatSyncTime(overallLastSync)}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => setConfirmAction({ type: 'all' })} disabled={loadingAll || !!loadingTime}>
            {loadingAll ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Atualizando...</> : <><RefreshCw className="h-4 w-4 mr-2" /> Atualizar Todos</>}
          </Button>
          <p className="text-sm text-muted-foreground">Reprocessar horário específico:</p>
          <div className="grid grid-cols-3 gap-2">
            {drawTimes.map(t => (
              <div key={t} className="flex flex-col">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: 'single', time: t })} disabled={loadingAll || !!loadingTime}>
                  {loadingTime === t ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  {labelsMap[t]}
                </Button>
                {lastSyncData?.[t] && (
                  <span className="text-[10px] text-muted-foreground text-center mt-0.5">{formatSyncTime(lastSyncData[t])}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={open => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reprocessamento</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'all'
                ? `Deseja reprocessar TODOS os horários ${title}?`
                : `Deseja reprocessar ${confirmAction?.time ? labelsMap[confirmAction.time] : ''}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ===================== Federal Results Section =====================

function FederalResultsSection() {
  const { user } = useAuth();
  const { data: latestFederal } = useLatestFederalResult();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [drawDate, setDrawDate] = useState(getTodayDateString());
  const [drawNumber, setDrawNumber] = useState('');
  const [milhares, setMilhares] = useState(['', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load existing if same date
  useEffect(() => {
    if (latestFederal && latestFederal.draw_date === drawDate) {
      setMilhares([
        latestFederal.prize_1_milhar === '0000' ? '' : latestFederal.prize_1_milhar,
        latestFederal.prize_2_milhar === '0000' ? '' : latestFederal.prize_2_milhar,
        latestFederal.prize_3_milhar === '0000' ? '' : latestFederal.prize_3_milhar,
        latestFederal.prize_4_milhar === '0000' ? '' : latestFederal.prize_4_milhar,
        latestFederal.prize_5_milhar === '0000' ? '' : latestFederal.prize_5_milhar,
      ]);
      setDrawNumber(latestFederal.draw_number || '');
    } else {
      setMilhares(['', '', '', '', '']);
      setDrawNumber('');
    }
  }, [latestFederal, drawDate]);

  const updateMilhar = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    const next = [...milhares]; next[index] = cleaned; setMilhares(next);
    if (cleaned.length === 4 && index < 4) setTimeout(() => inputRefs.current[index + 1]?.focus(), 50);
  };

  const buildPrizeData = (currentMilhares: string[]) => {
    const data: Record<string, any> = {};
    currentMilhares.forEach((m, i) => {
      const num = i + 1;
      if (m.length === 4) {
        const { group, name } = getBichoFromMillhar(m);
        data[`prize_${num}_milhar`] = m;
        data[`prize_${num}_group`] = group;
        data[`prize_${num}_bicho`] = name;
      } else {
        data[`prize_${num}_milhar`] = '0000';
        data[`prize_${num}_group`] = 0;
        data[`prize_${num}_bicho`] = '';
      }
    });
    return data;
  };

  const saveSinglePrize = async (index: number) => {
    if (milhares[index].length !== 4 || !user) return;
    setSavingIndex(index);
    try {
      const prizeData = buildPrizeData(milhares);
      const { error } = await supabase.from('federal_results' as any).upsert({
        draw_date: drawDate,
        draw_number: drawNumber || null,
        ...prizeData,
        created_by: user.id, status: 'confirmed', updated_at: new Date().toISOString(),
      } as any, { onConflict: 'draw_date' });

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['federal_results'] });
      toast({ title: '✅ Salvo', description: `${index + 1}° Prêmio Federal salvo!` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = milhares.filter(m => m.length === 4);
    if (filled.length === 0 || !user) return;
    setSubmitting(true);
    try {
      const prizeData = buildPrizeData(milhares);
      const { error } = await supabase.from('federal_results' as any).upsert({
        draw_date: drawDate,
        draw_number: drawNumber || null,
        ...prizeData,
        created_by: user.id, status: 'confirmed', updated_at: new Date().toISOString(),
      } as any, { onConflict: 'draw_date' });

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['federal_results'] });
      toast({ title: '✅ Federal Salvo', description: `Resultado Federal de ${drawDate} publicado!` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!latestFederal || latestFederal.draw_date !== drawDate) return;
    try {
      const { error } = await supabase.from('federal_results' as any).delete().eq('id', latestFederal.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['federal_results'] });
      setMilhares(['', '', '', '', '']);
      setDrawNumber('');
      toast({ title: '🗑️ Removido' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" /> Federal — Cadastrar Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitAll} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Data do Sorteio</label>
                <Input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nº do Concurso (opcional)</label>
                <Input placeholder="Ex: 5923" value={drawNumber} onChange={e => setDrawNumber(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground">Milhares (salve um por um ou todos de uma vez)</label>
              {milhares.map((m, i) => {
                const preview = m.length === 4 ? getBichoFromMillhar(m) : null;
                const isSaved = latestFederal && latestFederal.draw_date === drawDate && 
                  (latestFederal as any)[`prize_${i+1}_milhar`] === m && m.length === 4 && m !== '0000';
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">{i + 1}° Prêmio</span>
                    <Input ref={el => { inputRefs.current[i] = el; }} placeholder="0000" value={m} onChange={e => updateMilhar(i, e.target.value)}
                      className={`font-mono text-lg tracking-widest max-w-28 ${isSaved ? 'border-primary/50 bg-primary/5' : ''}`} maxLength={4} />
                    {preview && <span className="text-xs text-muted-foreground">{BICHOS.find(b => b.group === preview.group)?.emoji} G{String(preview.group).padStart(2, '0')}</span>}
                    <Button type="button" size="sm" variant="outline" disabled={m.length !== 4 || savingIndex === i}
                      onClick={() => saveSinglePrize(i)}>
                      {savingIndex === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    {isSaved && <span className="text-primary text-xs">✓</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={submitting || milhares.every(m => m.length !== 4)}>
                {submitting ? 'Salvando...' : 'Salvar Todos'}
              </Button>
              {latestFederal && latestFederal.draw_date === drawDate && (
                <Button type="button" variant="destructive" size="icon" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {latestFederal && (
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Último Resultado Federal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Data: {latestFederal.draw_date} {latestFederal.draw_number ? `• Concurso ${latestFederal.draw_number}` : ''}
            </p>
            <div className="space-y-1">
              {[1,2,3,4,5].map(n => {
                const m = (latestFederal as any)[`prize_${n}_milhar`];
                const bicho = (latestFederal as any)[`prize_${n}_bicho`];
                const group = (latestFederal as any)[`prize_${n}_group`];
                if (m === '0000' || !m) return <p key={n} className="text-sm text-muted-foreground">{n}° — aguardando</p>;
                return <p key={n} className="text-sm"><span className="text-muted-foreground">{n}°</span> <span className="font-mono font-bold text-primary">{m}</span> — {BICHOS.find(b => b.group === group)?.emoji} {bicho}</p>;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===================== Results Tab (combines PT-Rio + Capital + Federal) =====================

function ResultsTab() {
  return (
    <Tabs defaultValue="ptrio" className="space-y-6">
      <TabsList className="w-full">
        <TabsTrigger value="ptrio" className="flex-1 flex items-center gap-1.5">
          <MapPin className="h-4 w-4" /> PT-Rio
        </TabsTrigger>
        <TabsTrigger value="capital" className="flex-1 flex items-center gap-1.5">
          <MapPin className="h-4 w-4" /> Capital
        </TabsTrigger>
        <TabsTrigger value="federal" className="flex-1 flex items-center gap-1.5">
          <Trophy className="h-4 w-4" /> Federal
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ptrio"><PTRioResultsSection /></TabsContent>
      <TabsContent value="capital"><CapitalResultsSection /></TabsContent>
      <TabsContent value="federal"><FederalResultsSection /></TabsContent>
    </Tabs>
  );
}

// ===================== Sponsors Tab =====================

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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [position, setPosition] = useState('sidebar');
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !file) {
      toast({ title: 'Erro', description: 'Preencha o nome e selecione uma imagem', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('sponsors').upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('sponsors').getPublicUrl(filePath);

      const { error } = await supabase.from('sponsors').insert({
        name, image_url: urlData.publicUrl, link_url: linkUrl || null, position, created_by: user!.id,
      });
      if (error) throw error;

      toast({ title: 'Patrocinador adicionado!' });
      setName(''); setFile(null); setPreview(null); setLinkUrl('');
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/storage/v1/object/public/sponsors/');
      if (pathParts[1]) await supabase.storage.from('sponsors').remove([pathParts[1]]);
    } catch { /* ignore */ }

    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast({ title: 'Patrocinador removido' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Adicionar Patrocinador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome do anunciante</label>
              <Input placeholder="Ex: Casa de Apostas XYZ" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Banner (imagem)</label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('sponsor-file-input')?.click()}>
                {preview ? (
                  <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded-md" />
                ) : (
                  <div className="py-4">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar</p>
                  </div>
                )}
              </div>
              <input id="sponsor-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Link de destino (opcional)</label>
              <Input placeholder="https://site-do-anunciante.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Posição no site</label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Topo do Site</SelectItem>
                  <SelectItem value="sidebar">Barra Lateral</SelectItem>
                  <SelectItem value="between_results">Entre Resultados</SelectItem>
                  <SelectItem value="footer">Rodapé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !file}>
              {submitting ? 'Enviando...' : 'Adicionar Patrocinador'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="font-display text-lg font-bold">Patrocinadores Cadastrados</h3>
      {allSponsors && allSponsors.length > 0 ? (
        <div className="space-y-3">
          {allSponsors.map(s => (
            <Card key={s.id} className="gradient-card border-border/50">
              <CardContent className="py-4 flex items-center gap-4">
                <img src={s.image_url} alt={s.name} className="h-12 w-20 object-cover rounded-md border border-border/50" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.position === 'header' ? 'Topo' : s.position === 'sidebar' ? 'Lateral' : s.position === 'between_results' ? 'Entre Resultados' : 'Rodapé'}
                    {' • '}{s.is_active ? '🟢 Ativo' : '🔴 Inativo'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id, s.image_url)}>
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

// ===================== Main Admin Dashboard =====================

export default function AdminDashboard() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const { data: backendIsAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ['user-role-check', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', { _user_id: user!.id, _role: 'admin' });
      if (error) throw error;
      return data as boolean;
    },
    staleTime: 30000,
  });

  if (loading || checkingRole) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  const hasAdminAccess = isAdmin || backendIsAdmin === true;

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="gradient-card border-border/50 max-w-md w-full">
          <CardContent className="py-10 text-center space-y-5">
            <Trophy className="h-12 w-12 text-primary mx-auto" />
            <p className="text-lg font-bold">Aguardando Autorização</p>
            <p className="text-sm text-muted-foreground">Sua conta ainda não foi autorizada pelo administrador.</p>
            <Button variant="destructive" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="font-display text-xl font-bold">Painel Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground hidden sm:block">
              <p className="truncate max-w-[200px]">{user.email}</p>
              <p className="text-primary font-semibold">● Admin</p>
            </div>
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
            <Button variant="destructive" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
