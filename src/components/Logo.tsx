import { CheckIcon } from "./icons";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-[10px] bg-ink text-ink-fg">
        <CheckIcon size={18} className="stroke-[3]" />
      </span>
      <span className="text-lg font-bold tracking-[-0.02em]">ODOT</span>
    </span>
  );
}
