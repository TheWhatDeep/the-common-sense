/** Icons copied from the mockup's inline SVGs. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.8,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': true,
};

export const MenuIcon = () => (
  <svg width="22" height="22" {...base}>
    <path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h10" />
  </svg>
);
export const PlusIcon = () => (
  <svg width="56" height="56" {...base} stroke-width={1.6}>
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);
export const CloseIcon = () => (
  <svg width="22" height="22" {...base}>
    <path d="M6 6l12 12" /><path d="M18 6L6 18" />
  </svg>
);
export const BackIcon = () => (
  <svg width="22" height="22" {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ProfileIcon = () => (
  <svg width="20" height="20" {...base}>
    <circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </svg>
);
export const SettingsIcon = () => (
  <svg width="20" height="20" {...base}>
    <path d="M4 6h10" /><path d="M18 6h2" /><circle cx="16" cy="6" r="2" />
    <path d="M4 12h4" /><path d="M12 12h8" /><circle cx="10" cy="12" r="2" />
    <path d="M4 18h12" /><path d="M20 18h0" /><circle cx="18" cy="18" r="2" />
  </svg>
);
export const LogoutIcon = () => (
  <svg width="20" height="20" {...base}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" />
  </svg>
);
export const TrashIcon = () => (
  <svg width="20" height="20" {...base}>
    <path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" />
  </svg>
);
export const AlertIcon = () => (
  <svg width="28" height="28" {...base}>
    <path d="M12 3l9.5 17h-19z" /><path d="M12 10v4" /><path d="M12 17.5h0" />
  </svg>
);
export const PillarsMark = () => (
  <svg width="40" height="40" {...base} stroke-width={1.8}>
    <path d="M3 20h18" /><path d="M4 7h16" /><path d="M12 3l8 4H4z" />
    <path d="M6 10v7" /><path d="M10 10v7" /><path d="M14 10v7" /><path d="M18 10v7" />
  </svg>
);
export const PillarsIcon = () => (
  <svg width="20" height="20" {...base}>
    <path d="M3 20h18" /><path d="M4 8h16" /><path d="M12 3l8 5H4z" />
    <path d="M6.5 11v6" /><path d="M10.5 11v6" /><path d="M13.5 11v6" /><path d="M17.5 11v6" />
  </svg>
);
export const ChevronDownIcon = () => (
  <svg width="20" height="20" {...base}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
