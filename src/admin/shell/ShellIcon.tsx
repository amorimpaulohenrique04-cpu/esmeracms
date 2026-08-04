import React from 'react'

export function ShellIcon({ name, className = 'esmera-shell-icon' }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4z"/><path d="M12 11v10"/></>,
    tag: <><path d="M4 5h8l8 8-7 7-8-8z"/><circle cx="9" cy="9" r="1"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7"/><path d="M15 5c3 0 5 2 5 5 0 1.5-.6 2.8-1.6 3.7M16 14c3 .6 5 2.8 5 6"/></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    heart: <path d="M12 20s-8-4.7-8-11a4 4 0 0 1 7-2.7L12 8l1-1.7A4 4 0 0 1 20 9c0 6.3-8 11-8 11Z"/>,
    chart: <><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
    database: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    shield: <path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6z"/>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    person: <><circle cx="12" cy="8" r="3"/><path d="M5 21c0-4.5 2.8-8 7-8s7 3.5 7 8"/></>,
    clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></>,
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" aria-hidden="true">
      {paths[name] || paths.grid}
    </svg>
  )
}
