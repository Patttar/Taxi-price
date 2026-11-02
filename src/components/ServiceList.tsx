import { ExternalLink, Phone } from 'lucide-react';

import type { Offer } from '@/lib/prices';
import { cn } from '@/lib/utils';

const ACTION_CLASS =
  'flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-primary transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring';

function formatPrice(price: number) {
  const value = price.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} Br`;
}

export default function ServiceList({ offers }: { offers: Offer[] }) {
  const [cheapest] = offers;

  return (
    <ol className="flex flex-col gap-3">
      {offers.map((offer, index) => {
        const isBest = index === 0;
        const overpay = offer.price - cheapest.price;

        return (
          <li
            key={offer.name}
            className={cn(
              'flex flex-col gap-3 rounded-2xl border bg-card p-4',
              isBest && 'border-success/40 ring-1 ring-success/40',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">{offer.name}</div>
                <div className="text-sm text-muted-foreground">{offer.tariffName}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold">{formatPrice(offer.price)}</div>
                {overpay > 0 && (
                  <div className="text-xs text-muted-foreground">+{formatPrice(overpay)}</div>
                )}
              </div>
            </div>

            {isBest && (
              <div className="w-fit rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                Лучший и самый дешёвый
              </div>
            )}

            <div className={cn('grid gap-2', offer.link && offer.phone && 'grid-cols-2')}>
              {offer.link && (
                <a className={ACTION_CLASS} href={offer.link.href} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {offer.link.label}
                </a>
              )}
              {offer.phone && (
                <a className={ACTION_CLASS} href={offer.phone.href}>
                  <Phone className="size-4" />
                  {offer.phone.label}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
