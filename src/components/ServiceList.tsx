import { ExternalLink, Phone, Sparkles } from 'lucide-react';

import type { Offer } from '@/lib/prices';
import { cn } from '@/lib/utils';

const ACTION_CLASS =
  'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring';

// Лаймом выделяем только главное действие — заказ у самого выгодного сервиса.
const ACTION_STYLES = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  glass: 'bg-white/10 text-white hover:bg-white/15',
  plain: 'bg-muted text-foreground hover:bg-accent',
};

const BEST_CARD_BACKGROUND =
  'bg-[radial-gradient(120%_90%_at_100%_0%,rgb(220_255_0/0.22),transparent_55%),radial-gradient(80%_60%_at_0%_100%,rgb(30_154_75/0.25),transparent_60%),linear-gradient(160deg,#2a2c2f,#131416)]';

function formatPrice(price: number) {
  const value = price.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} Br`;
}

type Action = { href: string; label: string; icon: typeof Phone; isExternal: boolean };

function getActions(offer: Offer): Action[] {
  return [
    offer.link && { ...offer.link, icon: ExternalLink, isExternal: true },
    offer.phone && { ...offer.phone, icon: Phone, isExternal: false },
  ].filter((action): action is Action => Boolean(action));
}

export default function ServiceList({ offers }: { offers: Offer[] }) {
  const [cheapest] = offers;
  // Ярлык «выгоднее» имеет смысл, только когда есть с чем сравнить.
  const hasChoice = offers.length > 1;
  const saving = offers.at(-1)!.price - cheapest.price;

  return (
    <ol className="flex flex-col gap-3">
      {offers.map((offer, index) => {
        const isBest = hasChoice && index === 0;
        const overpay = offer.price - cheapest.price;
        const actions = getActions(offer);

        return (
          <li
            key={offer.name}
            style={{ animationDelay: `${index * 60}ms` }}
            className={cn(
              'flex flex-col gap-4 rounded-3xl p-4 animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-300',
              isBest
                ? `${BEST_CARD_BACKGROUND} text-white shadow-xl ring-1 ring-white/10`
                : 'border bg-card',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                {isBest && (
                  <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15 backdrop-blur">
                    <Sparkles className="size-3.5 text-primary" />
                    Выгоднее всего
                  </span>
                )}
                <div>
                  <div className="text-base font-semibold">{offer.name}</div>
                  <div className={cn('text-sm', isBest ? 'text-white/60' : 'text-muted-foreground')}>
                    {offer.tariffName}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={cn('font-bold tracking-tight', isBest ? 'text-3xl' : 'text-lg')}>
                  {formatPrice(offer.price)}
                </div>
                {isBest && saving > 0 && (
                  <div className="text-xs text-white/60">дешевле на {formatPrice(saving)}</div>
                )}
                {overpay > 0 && (
                  <div className="text-xs text-muted-foreground">+{formatPrice(overpay)}</div>
                )}
              </div>
            </div>

            <div className={cn('grid gap-2', actions.length > 1 && 'grid-cols-2')}>
              {actions.map(({ href, label, icon: Icon, isExternal }, actionIndex) => {
                const style = isBest
                  ? actionIndex === 0
                    ? ACTION_STYLES.primary
                    : ACTION_STYLES.glass
                  : hasChoice
                    ? ACTION_STYLES.plain
                    : ACTION_STYLES.primary;
                return (
                  <a
                    key={href}
                    href={href}
                    className={cn(ACTION_CLASS, style)}
                    {...(isExternal && { target: '_blank', rel: 'noreferrer' })}
                  >
                    <Icon className="size-4" />
                    {label}
                  </a>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
