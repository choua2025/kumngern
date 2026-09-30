import {
  ArrowLeftRight,
  Briefcase,
  Bus,
  CircleEllipsis,
  CirclePlus,
  Clapperboard,
  Coffee,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
  Receipt,
  ShoppingBag,
  Tag,
  Utensils,
} from 'lucide-react';

/** Icon names stored in categories.icon (seed uses lucide names). Unknown → Tag. */
const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  laptop: Laptop,
  gift: Gift,
  'circle-plus': CirclePlus,
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  home: House,
  receipt: Receipt,
  'shopping-bag': ShoppingBag,
  'heart-pulse': HeartPulse,
  clapperboard: Clapperboard,
  'graduation-cap': GraduationCap,
  'circle-ellipsis': CircleEllipsis,
  transfer: ArrowLeftRight,
};

export function CategoryIcon({
  icon,
  color,
  size = 'md',
}: {
  icon: string | null;
  color: string | null;
  size?: 'sm' | 'md';
}) {
  const Icon = (icon && ICONS[icon]) || Tag;
  const box = size === 'sm' ? 'size-7' : 'size-9';
  return (
    <span
      aria-hidden
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color ?? '#64748b'} 18%, transparent)`,
        color: color ?? '#64748b',
      }}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4.5'} />
    </span>
  );
}
