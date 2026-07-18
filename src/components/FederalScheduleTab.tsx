import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Save, CalendarClock } from 'lucide-react';

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

interface Row {
  id: string;
  weekday: number;
  draw_hour: number;
  draw_minute: number;
  enabled: boolean;
}

export function FederalScheduleTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rows = [] } = useQuery<Row[]>({
    queryKey: ['federal-schedule-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('federal_schedule' as any)
        .select('id, weekday, draw_hour, draw_minute, enabled')
        .order('weekday');
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['federal-schedule-admin'] });
    await qc.invalidateQueries({ queryKey: ['federal-schedule'] });
  };

  const [newDay, setNewDay] = useState<number>(3);
  const [newHour, setNewHour] = useState<string>('20');
  const [newMinute, setNewMinute] = useState<string>('30');

  const addRule = async () => {
    const h = Number(newHour), m = Number(newMinute);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      toast({ title: 'Horário inválido', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('federal_schedule' as any).insert({
      weekday: newDay, draw_hour: h, draw_minute: m, enabled: true,
    });
    if (error) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Regra adicionada' });
    await refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-accent" />
          Agenda da Federal
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure em quais dias e horários (BRT) o sorteio da Federal ocorre.
          Padrão: quarta 20:30 e domingo 11:34. Alterações valem imediatamente
          para o countdown, teleprompter, agenda e validação do robô de scraping.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada — os padrões (Qua 20:30 e Dom 11:34) estão sendo usados.</p>
          )}
          {rows.map((row) => (
            <FederalScheduleRow key={row.id} row={row} onChange={refresh} />
          ))}
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-semibold">Adicionar novo horário</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground">Dia</label>
              <Select value={String(newDay)} onValueChange={(v) => setNewDay(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((w) => (
                    <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <label className="text-xs text-muted-foreground">Hora</label>
              <Input inputMode="numeric" value={newHour} onChange={(e) => setNewHour(e.target.value)} />
            </div>
            <div className="w-20">
              <label className="text-xs text-muted-foreground">Minuto</label>
              <Input inputMode="numeric" value={newMinute} onChange={(e) => setNewMinute(e.target.value)} />
            </div>
            <Button onClick={addRule}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FederalScheduleRow({ row, onChange }: { row: Row; onChange: () => void }) {
  const { toast } = useToast();
  const [hour, setHour] = useState(String(row.draw_hour).padStart(2, '0'));
  const [minute, setMinute] = useState(String(row.draw_minute).padStart(2, '0'));
  const [enabled, setEnabled] = useState(row.enabled);
  const [saving, setSaving] = useState(false);

  const label = WEEKDAYS.find((w) => w.value === row.weekday)?.label ?? `Dia ${row.weekday}`;

  const save = async () => {
    const h = Number(hour), m = Number(minute);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      toast({ title: 'Horário inválido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('federal_schedule' as any)
      .update({ draw_hour: h, draw_minute: m, enabled })
      .eq('id', row.id);
    setSaving(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: '✅ Salvo' });
    onChange();
  };

  const remove = async () => {
    const { error } = await supabase.from('federal_schedule' as any).delete().eq('id', row.id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: '🗑️ Removido' });
    onChange();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
      <div className="min-w-[100px] font-semibold">{label}</div>
      <Input className="w-16" value={hour} onChange={(e) => setHour(e.target.value)} inputMode="numeric" />
      <span>:</span>
      <Input className="w-16" value={minute} onChange={(e) => setMinute(e.target.value)} inputMode="numeric" />
      <div className="flex items-center gap-2 ml-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <span className="text-xs text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
      </div>
      <div className="ml-auto flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
        <Button size="sm" variant="destructive" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
