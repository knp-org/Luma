import logo from "../assets/logo.png";
import { 
    GlassButton,
    GlassHeading,
    GlassDivider,
    IconLibrary,
    IconGenres,
    IconAlbums,
    IconPlaylists,
    IconFavorites,
    IconAnalytics,
    IconSettings
} from "@knp-org/liquid-glass-ui";

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
                <GlassHeading as="h1" gradient glow className="text-3xl font-bold tracking-tight">
                    Luma
                </GlassHeading>
            </div>
            <nav className="flex flex-col gap-2">
                <SidebarItem
                    label="Library"
                    icon={<IconLibrary />}
                    active={currentView === "library"}
                    onClick={() => onViewChange("library")}
                />
                <SidebarItem
                    label="Genres"
                    icon={<IconGenres />}
                    active={currentView === "genres"}
                    onClick={() => onViewChange("genres")}
                />
                <SidebarItem
                    label="Albums"
                    icon={<IconAlbums />}
                    active={currentView === "albums"}
                    onClick={() => onViewChange("albums")}
                />
                <SidebarItem
                    label="Playlists"
                    icon={<IconPlaylists />}
                    active={currentView === "playlists"}
                    onClick={() => onViewChange("playlists")}
                />
                <SidebarItem
                    label="Favorites"
                    icon={<IconFavorites />}
                    active={currentView === "favorites"}
                    onClick={() => onViewChange("favorites")}
                />
                <SidebarItem
                    label="Analytics"
                    icon={<IconAnalytics />}
                    active={currentView === "analytics"}
                    onClick={() => onViewChange("analytics")}
                />
                <GlassDivider className="my-2" />
                <SidebarItem
                    label="Settings"
                    icon={<IconSettings />}
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
        <GlassButton
            onClick={onClick}
            variant={active ? "primary" : "secondary"}
            className="w-full flex items-center justify-start gap-3"
            style={{
                backgroundColor: active ? "rgba(255, 255, 255, 0.15)" : "transparent",
                border: active ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid transparent",
                boxShadow: active ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)" : "none",
                fontWeight: active ? 500 : 400
            }}
        >
            <span className={`transition-colors ${active ? "text-white" : "text-white/50"}`}>
                {icon}
            </span>
            <span className={active ? "text-white" : "text-white/80"}>{label}</span>
        </GlassButton>
    );
}
