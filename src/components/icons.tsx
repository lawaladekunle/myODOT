import type { ReactNode } from "react";

type Props = { className?: string; size?: number };

function icon(paths: ReactNode) {
  return function Icon({ className, size = 18 }: Props) {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {paths}
      </svg>
    );
  };
}

export const SearchIcon = icon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const MatrixIcon = icon(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>);
export const ListIcon = icon(<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />);
export const BoardIcon = icon(<><rect x="3.5" y="4" width="5" height="15" rx="1.5" /><rect x="10.5" y="4" width="5" height="10" rx="1.5" /><rect x="17.5" y="4" width="3" height="12" rx="1.5" /></>);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const TrashIcon = icon(<path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7" />);
export const RepeatIcon = icon(<path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />);
export const BotIcon = icon(<><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M9.5 4h5M9 14h.01M15 14h.01" /></>);
export const SettingsIcon = icon(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>);
export const HistoryIcon = icon(<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" />);
export const LogOutIcon = icon(<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />);
export const InboxIcon = icon(<path d="M3 13l3-8h12l3 8M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M3 13h5l1 3h6l1-3h5" />);
export const UrgentIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>);
export const ScheduleIcon = icon(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M9 13l2 2 4-4" /></>);
export const DelegateIcon = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const EliminateIcon = icon(<path d="M5 10h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2" />);
export const UndoIcon = icon(<path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />);
export const DownloadIcon = icon(<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />);
export const KeyIcon = icon(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L20 3M16 7l3 3" /></>);
export const UsersIcon = icon(<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></>);
export const TagIcon = icon(<><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></>);
export const PlayIcon = icon(<path d="M7 4.5l11 7.5-11 7.5z" />);
export const BackIcon = icon(<path d="M15 6l-6 6 6 6" />);
export const TargetIcon = icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const CalendarIcon = icon(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></>);
export const UserIcon = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const CopyIcon = icon(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>);
