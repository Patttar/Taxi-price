type Props = {
  label: string;
  onClick: () => void;
};

export default function SheetHandle({ label, onClick }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-full shrink-0 cursor-grab items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-foreground/20" />
    </button>
  );
}
