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

  if (!sponsors || sponsors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {sponsors.map(s => (
        <SponsorBanner key={s.id} sponsor={s} />
      ))}
    </div>
  );
}
