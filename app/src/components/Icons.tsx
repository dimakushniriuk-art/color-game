type P = { size?: number };
const svg = (path: JSX.Element, size = 24) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

export const IconGallery = ({ size }: P) => svg(<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>, size);
export const IconBrush = ({ size }: P) => svg(<><path d="M9.06 11.9 18 3a2.1 2.1 0 0 1 3 3l-8.94 8.94" /><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.15 2-2 2 .92 1.22 2.49 2 4 2a4 4 0 0 0 4-4c0-1.66-1.34-3-3-3z" /></>, size);
export const IconSettings = ({ size }: P) => svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>, size);
export const IconBack = ({ size }: P) => svg(<path d="M15 18l-6-6 6-6" />, size);
export const IconBulb = ({ size }: P) => svg(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></>, size);
export const IconExpand = ({ size }: P) => svg(<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>, size);
export const IconCheck = ({ size }: P) => svg(<path d="M20 6 9 17l-5-5" />, size);
export const IconShare = ({ size }: P) => svg(<><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></>, size);
export const IconReplay = ({ size }: P) => svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>, size);
export const IconEye = ({ size }: P) => svg(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>, size);
export const IconChevron = ({ size }: P) => svg(<path d="M9 18l6-6-6-6" />, size);
export const IconTrophy = ({ size }: P) => svg(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3" /><path d="M7 5H4v2a3 3 0 0 0 3 3" /></>, size);
