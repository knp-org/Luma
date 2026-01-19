import logo from "../assets/logo.png";

type View = "library" | "albums" | "playlists" | "settings" | "genres" | "favorites" | "analytics";

interface SidebarProps {
    currentView: View;
    onViewChange: (view: View) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
    return (
        <aside className="w-64 bg-white/5 backdrop-blur-2xl border-r border-white/10 flex flex-col p-6 gap-6 hidden md:flex z-20 shadow-2xl">
            <div className="flex items-center gap-4 px-2">
                <img
                    src={logo}
                    alt="Luma Logo"
                    className="w-12 h-12"
                />
                <div className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">
                    Luma
                </div>
            </div>
            <nav className="flex flex-col gap-2">
                <SidebarItem
                    label="Library"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z" />
                        </svg>
                    }
                    active={currentView === "library"}
                    onClick={() => onViewChange("library")}
                />
                <SidebarItem
                    label="Genres"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l-5.5 9h11z" />
                            <circle cx="17.5" cy="17.5" r="4.5" />
                            <rect x="3" y="13" width="9" height="9" />
                        </svg>
                    }
                    active={currentView === "genres"}
                    onClick={() => onViewChange("genres")}
                />
                <SidebarItem
                    label="Albums"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5s2.01-4.5 4.5-4.5 4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                        </svg>
                    }
                    active={currentView === "albums"}
                    onClick={() => onViewChange("albums")}
                />
                <SidebarItem
                    label="Playlists"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                        </svg>
                    }
                    active={currentView === "playlists"}
                    onClick={() => onViewChange("playlists")}
                />
                <SidebarItem
                    label="Favorites"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                    }
                    active={currentView === "favorites"}
                    onClick={() => onViewChange("favorites")}
                />
                <SidebarItem
                    label="Analytics"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                        </svg>
                    }
                    active={currentView === "analytics"}
                    onClick={() => onViewChange("analytics")}
                />
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2 mx-4" />
                <SidebarItem
                    label="Settings"
                    icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                        </svg>
                    }
                    active={currentView === "settings"}
                    onClick={() => onViewChange("settings")}
                />
            </nav>
        </aside>
    );
}

interface SidebarItemProps {
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

function SidebarItem({ label, icon, active, onClick }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 text-left px-4 py-2.5 rounded-xl transition-all duration-200 group ${active
                ? "bg-white/10 backdrop-blur-md text-white font-medium shadow-lg shadow-white/5 border border-white/10"
                : "hover:bg-white/5 text-white/50 hover:text-white/80 border border-transparent"
                }`}
        >
            <span className={`transition-colors ${active ? "text-white" : "text-white/40 group-hover:text-white/70"}`}>
                {icon}
            </span>
            {label}
        </button>
    );
}
