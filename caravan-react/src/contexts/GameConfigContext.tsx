import React, { createContext, useState, useContext, ReactNode } from 'react';
import { GameConfig, DEFAULT_CONFIG } from '../types/GameConfig';

interface GameConfigContextType {
    config: GameConfig;
    updateConfig: (newConfig: GameConfig) => void;
    resetConfig: () => void;
    exportConfig: () => void;
    importConfig: (json: string) => void;
}

const GameConfigContext = createContext<GameConfigContextType | undefined>(undefined);



// Deep merge utility (simple version)
const deepMerge = (target: any, source: any) => {
    for (const key in source) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], deepMerge(target[key], source[key]));
        }
    }
    Object.assign(target || {}, source);
    return target;
};

export const GameConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<GameConfig>(() => {
        // Init from localStorage if available, else Default
        try {
            const saved = localStorage.getItem('gameConfig');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with default to ensure new keys exist
                // We want Default to provide structure, but Saved to override values.
                // deepMerge(Default, Saved) -> Modifies Default? No, we need care.
                // Let's copy Default, then merge Saved into it.
                return deepMerge({ ...DEFAULT_CONFIG }, parsed);
            }
        } catch (e) {
            console.error("Failed to load config", e);
        }
        return DEFAULT_CONFIG;
    });

    const updateConfig = (newConfig: GameConfig) => {
        setConfig(newConfig);
        localStorage.setItem('gameConfig', JSON.stringify(newConfig));
    };

    const resetConfig = () => {
        setConfig(DEFAULT_CONFIG);
        localStorage.removeItem('gameConfig');
    };

    const exportConfig = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "game_config.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const importConfig = (jsonContent: string) => {
        try {
            const parsed = JSON.parse(jsonContent);
            // Basic validation could go here
            const merged = deepMerge({ ...DEFAULT_CONFIG }, parsed);
            updateConfig(merged);
        } catch (e) {
            console.error("Invalid Config JSON", e);
            throw e;
        }
    };

    return (
        <GameConfigContext.Provider value={{ config, updateConfig, resetConfig, exportConfig, importConfig }}>
            {children}
        </GameConfigContext.Provider>
    );
};

export const useGameConfig = () => {
    const context = useContext(GameConfigContext);
    if (!context) {
        throw new Error('useGameConfig must be used within a GameConfigProvider');
    }
    return context;
};
