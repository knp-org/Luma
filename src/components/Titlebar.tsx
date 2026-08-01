import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { GlassButton } from '@knp-org/liquid-glass-ui';
import { IconTitlebarMinimize, IconTitlebarMaximize, IconTitlebarUnmaximize, IconTitlebarClose } from '@knp-org/liquid-glass-ui';

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
                <GlassButton
                    variant="ghost"
                    className="w-[46px] h-full flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => appWindow.minimize().catch(() => {})}
                    title="Minimize"
                >
                    <IconTitlebarMinimize />
                </GlassButton>
                <GlassButton
                    variant="ghost"
                    className="w-[46px] h-full flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => {
                        appWindow.toggleMaximize().then(() => appWindow.isMaximized()).then(setIsMaximized).catch(() => {});
                    }}
                    title={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? (
                        <IconTitlebarMaximize />
                    ) : (
                        <IconTitlebarUnmaximize />
                    )}
                </GlassButton>
                <GlassButton
                    variant="ghost"
                    className="w-[46px] h-full flex items-center justify-center text-white/50 hover:bg-red-500 hover:text-white transition-colors"
                    onClick={() => appWindow.close().catch(() => {})}
                    title="Close"
                >
                    <IconTitlebarClose />
                </GlassButton>
            </div>
        </div>
    );
}
