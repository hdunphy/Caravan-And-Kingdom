import React, { useState } from 'react';
import { useGameConfig } from '../contexts/GameConfigContext';
import { DEFAULT_CONFIG, GameConfig } from '../types/GameConfig';
import { X, Save, Download, Upload, RefreshCw, ChevronDown, ChevronRight, Settings as SettingsIcon } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
    const { config, updateConfig, resetConfig, exportConfig } = useGameConfig();
    const [activeTab, setActiveTab] = useState<'gameplay' | 'data'>('gameplay');

    // Gameplay State
    const [localConfig, setLocalConfig] = useState<GameConfig>(config);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        simulation: true,
        costs: true,
        trade: true,
        industry: true,
        yields: false,
        ai: false,
        settlementCosts: false,
        upgradeCosts: false
    });

    // Data State
    const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
    const [error, setError] = useState<string | null>(null);

    // Sync local on open? No, we start with initial config. 
    // But if we reset, we need to sync?

    const handleSave = () => {
        if (activeTab === 'data') {
            try {
                const parsed = JSON.parse(jsonText);
                updateConfig(parsed);
                onClose();
            } catch (e) {
                setError("Invalid JSON");
            }
        } else {
            updateConfig(localConfig);
            onClose();
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };



    // Recursive Helper for rendering config nodes
    const renderConfigNode = (key: string, value: any, path: string[], depth: number = 0) => {
        // Skip hidden/system keys if any (none for now)

        // 1. Primitive: Render Input
        if (typeof value !== 'object' || value === null) {
            return (
                <div key={key} className="flex flex-col">
                    <label className="text-xs text-slate-400 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                    <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => {
                            const newValue = typeof value === 'number' ? parseFloat(e.target.value) : e.target.value;
                            if (typeof value === 'number' && isNaN(newValue as number)) return;

                            // Deep update local config
                            setLocalConfig(prev => {
                                const newConfig = JSON.parse(JSON.stringify(prev));
                                let current = newConfig;
                                for (let i = 0; i < path.length; i++) {
                                    current = current[path[i]];
                                }
                                current[key] = newValue;
                                return newConfig;
                            });
                        }}
                        className="bg-slate-900 border border-slate-700 text-white text-xs p-1 rounded w-full"
                        step={typeof value === 'number' && !Number.isInteger(value) ? "0.01" : "1"}
                    />
                </div>
            );
        }

        // 2. Object: Render Collapsible Section
        const sectionKey = [...path, key].join('.');
        const isExpanded = expandedSections[sectionKey] !== false; // Default to true if not set? Or use explicit state. 
        // Let's default top-level true, others false/true based on preference. 
        // For now, let's just check the state map.

        return (
            <div key={key} className={`mb-2 border border-slate-700 rounded bg-slate-950 overflow-hidden ${depth > 0 ? 'ml-2' : ''}`}>
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between p-2 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-200"
                >
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                    <div className="p-2 grid grid-cols-2 gap-2">
                        {Object.entries(value).map(([childKey, childValue]) => (
                            <React.Fragment key={childKey}>
                                {typeof childValue === 'object' ? (
                                    // If child is object, it needs full width, so break out of grid? 
                                    // CSS Grid is tricky with mixed layout. 
                                    // Let's just wrap objects in a col-span-2 div.
                                    <div className="col-span-2">
                                        {renderConfigNode(childKey, childValue, [...path, key], depth + 1)}
                                    </div>
                                ) : (
                                    renderConfigNode(childKey, childValue, [...path, key], depth + 1)
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 p-0 rounded-lg w-[800px] h-[700px] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <SettingsIcon size={24} /> Settings
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-800/50">
                    <button
                        onClick={() => setActiveTab('gameplay')}
                        className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'gameplay' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                    >
                        Gameplay Tweaks
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'data' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                    >
                        Data (Import/Export)
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-900">
                    {activeTab === 'gameplay' && (
                        <div className="space-y-2">
                            {/* Recursively render all top-level keys */}
                            {Object.entries(localConfig).map(([key, value]) => renderConfigNode(key, value, []))}
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="flex flex-col h-full gap-4">
                            <div className="flex gap-2">
                                <button onClick={exportConfig} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                                    <Download size={14} /> Export JSON
                                </button>
                                <label className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm flex items-center gap-2 cursor-pointer">
                                    <Upload size={14} /> Import JSON
                                    <input type="file" accept=".json" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                                const text = ev.target?.result as string;
                                                setJsonText(text);
                                            };
                                            reader.readAsText(file);
                                        }
                                    }} className="hidden" />
                                </label>
                                <button onClick={() => { resetConfig(); setJsonText(JSON.stringify(DEFAULT_CONFIG, null, 2)); setLocalConfig(DEFAULT_CONFIG); }} className="bg-red-900/50 hover:bg-red-900 text-red-100 px-3 py-1 rounded text-sm flex items-center gap-2 ml-auto">
                                    <RefreshCw size={14} /> Reset Defaults
                                </button>
                            </div>

                            {error && <div className="text-red-500 text-sm">{error}</div>}

                            <textarea
                                className="flex-1 bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded border border-slate-800 resize-none focus:outline-none focus:border-emerald-500/50"
                                value={jsonText}
                                onChange={(e) => { setJsonText(e.target.value); setError(null); }}
                                spellCheck={false}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded flex items-center gap-2 font-bold shadow-lg shadow-emerald-900/20">
                        <Save size={16} /> Save & Apply
                    </button>
                </div>
            </div>
        </div>
    );
};
