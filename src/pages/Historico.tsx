import { useState } from 'react';
import { useResultsByDate } from '@/hooks/useResults';
import { DRAW_TIMES, DRAW_TIME_LABELS, getBichoByGroup, formatDrawDate, getTodayDateString } from '@/lib/bichos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, ArrowLeft, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Historico() {
  const [date, setDate] = useState(getTodayDateString());
  const { data: results, isLoading } = useResultsByDate(date);

  const changeDate = (days: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="font-display text-xl font-bold tracking-tight">Jogos Online</h1>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          Histórico de Resultados
        </h2>

        <div className="flex items-center gap-3 mb-8">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="max-w-48"
          />
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">{formatDrawDate(date)}</span>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Card key={i} className="gradient-card border-border/50 animate-pulse h-40" />)}
          </div>
        ) : results && results.length > 0 ? (
          <div className="space-y-4">
            {results.map(r => (
              <Card key={r.id} className="gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">PT-Rio {DRAW_TIME_LABELS[r.draw_time]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => {
                      const milhar = r[`prize_${i}_milhar` as keyof typeof r] as string;
                      const group = r[`prize_${i}_group` as keyof typeof r] as number;
                      const bicho = r[`prize_${i}_bicho` as keyof typeof r] as string;
                      const bichoData = getBichoByGroup(group);
                      return (
                        <div key={i} className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">{i}° Prêmio</p>
                          <p className="font-display font-bold text-lg">{milhar}</p>
                          <p className="text-lg">{bichoData?.emoji}</p>
                          <p className="text-xs text-muted-foreground">{bicho}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="gradient-card border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum resultado encontrado para esta data.
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
