import { useSponsors, type Sponsor } from '@/hooks/useSponsors';

function SponsorBanner({ sponsor }: { sponsor: Sponsor }) {
  const content = (
    <img
      src={sponsor.image_url}
      alt={sponsor.name}
      className="w-full h-auto rounded-md object-cover"
      loading="lazy"
    />
  );

  if (sponsor.link_url) {
    return (
      <a href={sponsor.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
        {content}
      </a>
    );
  }
  return <div>{content}</div>;
}

export function SponsorSlot({ position, className = '' }: { position: string; className?: string }) {
  const { data: sponsors } = useSponsors(position);
  const isHeader = position === 'header';

  if (!sponsors || sponsors.length === 0) {
    return (
      <div className={`border border-dashed border-border/40 rounded-lg ${isHeader ? 'p-2' : 'p-4'} flex items-center justify-center text-xs text-muted-foreground/40 ${className}`}>
        Espaço Publicitário
      </div>
    );
  }

  return (
    <div className={`${isHeader ? 'space-y-1' : 'space-y-3'} ${className}`}>
      {sponsors.map(s => (
        <SponsorBanner key={s.id} sponsor={s} compact={isHeader} />
      ))}
    </div>
  );
}
