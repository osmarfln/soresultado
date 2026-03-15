import { useState } from 'react';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { useResultsByDate } from '@/hooks/useResults';
import { useCapitalResultsByDate } from '@/hooks/useCapitalResults';
import { useFederalResultByDate } from '@/hooks/useFederalResults';
import { DRAW_TIME_LABELS, getBichoByGroup, formatDrawDate, getTodayDateString } from '@/lib/bichos';
import { CAPITAL_DRAW_TIME_LABELS } from '@/lib/capital';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Calendar, ArrowLeft, ArrowRight, MapPin, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/logo.png';

function ResultCard({ title, result }: { title: string; result: any }) {
  return (
    <Card className="gradient-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => {
            const milhar = result[`prize_${i}_milhar`] as string;
            const group = result[`prize_${i}_group`] as number;
            const bicho = result[`prize_${i}_bicho`] as string;
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
  );
}

export default function Historico() {
  useTrackVisit('/historico');
  const [date, setDate] = useState(getTodayDateString());
  const { data: results, isLoading } = useResultsByDate(date);
  const { data: capitalResults, isLoading: capitalLoading } = useCapitalResultsByDate(date);
  const { data: federalResult, isLoading: federalLoading } = useFederalResultByDate(date);

  const changeDate = (days: number) => {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    d.setDate(d.getDate() + days);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  };

  const hasResults = (results && results.length > 0) || (capitalResults && capitalResults.length > 0) || !!federalResult;
  const isAnyLoading = isLoading || capitalLoading || federalLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Só Resultados" className="h-8 w-auto" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
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

        {isAnyLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Card key={i} className="gradient-card border-border/50 animate-pulse h-40" />)}
          </div>
        ) : hasResults ? (
          <div className="space-y-8">
            {/* Federal */}
            {federalResult && (
              <section>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <h3 className="font-display text-xl font-bold">Federal</h3>
                  {federalResult.draw_number && (
                    <Badge variant="secondary" className="ml-1">Concurso {federalResult.draw_number}</Badge>
                  )}
                  {federalResult.draw_date !== date && (
                    <Badge variant="outline">Último resultado até a data: {formatDrawDate(federalResult.draw_date)}</Badge>
                  )}
                </div>
                <ResultCard title="Federal" result={federalResult} />
              </section>
            )}

            {/* PT-Rio */}
            {results && results.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-xl font-bold">PT-Rio</h3>
                </div>
                <div className="space-y-4">
                  {results.map(r => (
                    <ResultCard key={r.id} title={`PT-Rio ${DRAW_TIME_LABELS[r.draw_time]}`} result={r} />
                  ))}
                </div>
              </section>
            )}

            {/* Capital */}
            {capitalResults && capitalResults.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-xl font-bold">Capital</h3>
                </div>
                <div className="space-y-4">
                  {capitalResults.map(r => (
                    <ResultCard key={r.id} title={`Capital ${CAPITAL_DRAW_TIME_LABELS[r.draw_time] || r.draw_time}`} result={r} />
                  ))}
                </div>
              </section>
            )}
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
