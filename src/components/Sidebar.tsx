import { useEffect, useRef, useState } from 'react';
import logo from '../assets/logo.png';
import { GlassButton, GlassCard, IconChevronDown, IconLibrary, IconGenres, IconAlbums, IconPlaylists, IconFavorites, IconAnalytics, IconSettings, IconQueue } from '@knp-org/liquid-glass-ui';

type View = 'library' | 'albums' | 'genres' | 'playlists' | 'favorites' | 'queue' | 'analytics' | 'settings';
interface SidebarProps { currentView: View; onViewChange: (view: View) => void }
const destinations = [
    { view: 'library', label: 'Library', icon: IconLibrary },
    { view: 'albums', label: 'Albums', icon: IconAlbums },
    { view: 'genres', label: 'Genres', icon: IconGenres },
    { view: 'playlists', label: 'Playlists', icon: IconPlaylists },
    { view: 'favorites', label: 'Favorites', icon: IconFavorites },
    { view: 'queue', label: 'Queue', icon: IconQueue },
    { view: 'analytics', label: 'Analytics', icon: IconAnalytics },
    { view: 'settings', label: 'Settings', icon: IconSettings },
] as const;
function NavigationLinks({ currentView, onViewChange }: SidebarProps) {
    return <>{destinations.map(({ view, label, icon: Icon }) => <GlassButton key={view} type="button" variant={currentView === view ? "secondary" : "ghost"}
        className="luma-nav-item" aria-current={currentView === view ? 'page' : undefined}
        onClick={() => onViewChange(view)}><Icon size={20} /><span>{label}</span></GlassButton>)}</>;
}
export function Sidebar(props: SidebarProps) {
    return <aside data-sidebar className="luma-sidebar">
        <div className="luma-brand"><img src={logo} alt="" width="36" height="36" /><span>Luma</span></div>
        <nav aria-label="Main navigation"><NavigationLinks {...props} /></nav>
    </aside>;
}
export function MobileNavigation(props: SidebarProps) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('[aria-label="Navigate to a screen"]')?.focus(); } };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [open]);
    return <div ref={root} className="luma-mobile-nav">
        <GlassButton variant="ghost" type="button" className="luma-navigation-toggle" aria-label="Navigate to a screen" aria-expanded={open} aria-controls={open ? 'compact-navigation' : undefined} onClick={() => setOpen(!open)}>
            {destinations.find(item => item.view === props.currentView)?.label}<IconChevronDown size={18} aria-hidden="true" />
        </GlassButton>
        <span className="luma-mobile-brand">Luma</span>
        {open && <GlassCard className="luma-mobile-menu"><nav id="compact-navigation" aria-label="Compact navigation"><NavigationLinks {...props} onViewChange={view => { props.onViewChange(view); setOpen(false); root.current?.querySelector<HTMLButtonElement>('[aria-label="Navigate to a screen"]')?.focus(); }} /></nav></GlassCard>}
    </div>;
}
