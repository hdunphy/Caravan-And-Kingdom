import { useState } from 'react';
import { useGameSimulation } from './hooks/useGameSimulation';
import { MapGrid } from './components/MapGrid';
import { Dashboard } from './components/Dashboard';
import { Controls } from './components/Controls';
import { SettingsMenu } from './components/SettingsMenu';
import { Leaderboard } from './components/Leaderboard';
import { RoyalLedger } from './components/ledger/RoyalLedger';
import { Trophy, BarChart3 } from 'lucide-react';
import './index.css';

function App() {
    const { gameState, isRunning, togglePause, reset } = useGameSimulation();
    const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
    const [rightSidebarTab, setRightSidebarTab] = useState<'leaderboard' | 'ledger'>('leaderboard');

    return (
        <div className="h-screen w-screen flex bg-slate-950 overflow-hidden text-white font-sans">
            <Dashboard state={gameState} selectedHexId={selectedHexId} />
            <div className="flex-1 relative flex flex-col">
                <Controls isRunning={isRunning} onToggle={togglePause} onReset={reset} />
                <SettingsMenu />
                <MapGrid state={gameState} selectedHexId={selectedHexId} onSelectHex={setSelectedHexId} />
            </div>

            {/* Right Sidebar */}
            <div className="w-80 border-l border-slate-700 bg-slate-900 flex flex-col hidden lg:flex">
                {/* Tab Switcher */}
                <div className="flex bg-slate-800 border-b border-slate-700">
                    <button
                        onClick={() => setRightSidebarTab('leaderboard')}
                        className={`flex-1 py-3 flex justify-center items-center gap-2 text-xs font-bold transition-all ${rightSidebarTab === 'leaderboard' ? 'bg-slate-900 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Trophy size={14} /> Leaderboard
                    </button>
                    <button
                        onClick={() => setRightSidebarTab('ledger')}
                        className={`flex-1 py-3 flex justify-center items-center gap-2 text-xs font-bold transition-all ${rightSidebarTab === 'ledger' ? 'bg-slate-900 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <BarChart3 size={14} /> Royal Ledger
                    </button>
                </div>

                <div className="flex-1 overflow-hidden">
                    {rightSidebarTab === 'leaderboard' ? (
                        <Leaderboard state={gameState} />
                    ) : (
                        <RoyalLedger state={gameState} factionId="player_1" />
                    )}
                </div>
            </div>
        </div>
    )
}
export default App
