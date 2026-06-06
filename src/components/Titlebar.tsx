import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

export function Titlebar() {
    const appWindow = getCurrentWindow();
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        appWindow.isMaximized().then(setIsMaximized).catch(() => {});
        
        let unlisten: () => void;
        appWindow.onResized(() => {
            appWindow.isMaximized().then(setIsMaximized).catch(() => {});
        }).then(u => { unlisten = u; }).catch(() => {});

        return () => {
            if (unlisten) unlisten();
        };
    }, [appWindow]);

    const handleDrag = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        appWindow.startDragging().catch(() => {});
    };

    const handleDoubleClick = () => {
        appWindow.toggleMaximize()
            .then(() => appWindow.isMaximized())
            .then(setIsMaximized)
            .catch(() => {});
    };

    return (
        <div className="relative h-[36px] flex flex-shrink-0 items-stretch bg-transparent border-b border-white/5 select-none z-[3000] w-full">
            {/* Drag Region */}
            <div 
                data-tauri-drag-region 
                onPointerDown={handleDrag}
                onDoubleClick={handleDoubleClick}
                className="flex-1 h-full"
                style={{ WebkitAppRegion: 'drag' } as any}
            ></div>
            
            {/* Window Controls */}
            <div 
                className="flex h-full flex-shrink-0 items-stretch"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <button
                    className="w-[46px] h-full flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => appWindow.minimize().catch(() => {})}
                    title="Minimize"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="5.5" width="10" height="1" fill="currentColor"/></svg>
                </button>
                <button
                    className="w-[46px] h-full flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => {
                        appWindow.toggleMaximize().then(() => appWindow.isMaximized()).then(setIsMaximized).catch(() => {});
                    }}
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M3.5 3.5h5v5H3.5z" fill="none" stroke="currentColor" strokeWidth="1"/>
                            <path d="M5 1.5h5.5v5.5" fill="none" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                    )}
                </button>
                <button
                    className="w-[46px] h-full flex items-center justify-center text-white/50 hover:bg-red-500 hover:text-white transition-colors"
                    onClick={() => appWindow.close().catch(() => {})}
                    title="Close"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
            </div>
        </div>
    );
}
