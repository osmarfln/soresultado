import { useRecentResults } from '@/hooks/useResults';
import { BICHOS } from '@/lib/bichos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Trophy, BarChart3 } from 'lucide-react';

export default function Estatisticas() {
  const { data: results, isLoading } = useRecentResults(200);

  // Count frequency of each bicho across all prizes
  const frequency = new Map<number, number>();
  BICHOS.forEach(b => frequency.set(b.group, 0));

  results?.forEach(r => {
    for (let i = 1; i <= 5; i++) {
      const group = r[`prize_${i}_group` as keyof typeof r] as number;
      frequency.set(group, (frequency.get(group) || 0) + 1);
    }
  });

  const sorted = BICHOS.map(b => ({
    ...b,
    count: frequency.get(b.group) || 0,
  })).sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...sorted.map(s => s.count), 1);

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
          <BarChart3 className="h-6 w-6 text-primary" />
          Estatísticas — Bichos Mais Sorteados
        </h2>

        {isLoading ? (
          <Card className="gradient-card border-border/50 animate-pulse h-96" />
        ) : (
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Frequência nos últimos {results?.length || 0} sorteios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sorted.map((b, i) => (
                  <div key={b.group} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-6 text-right">{i + 1}.</span>
                    <span className="text-xl w-8">{b.emoji}</span>
                    <span className="text-sm font-medium w-24">{b.name}</span>
                    <div className="flex-1 h-6 bg-secondary rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-sm transition-all duration-500"
                        style={{ width: `${(b.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold w-8 text-right">{b.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
