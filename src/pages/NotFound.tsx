import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useTrackVisit } from '@/hooks/useTrackVisit';

const NotFound = () => {
  const location = useLocation();
  useTrackVisit(location.pathname);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <Link to="/" className="text-primary hover:text-primary/90 flex items-center justify-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
