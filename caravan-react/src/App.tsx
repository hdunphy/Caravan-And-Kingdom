import { useState } from 'react';
import { useGameSimulation } from './hooks/useGameSimulation';
import { MapGrid } from './components/MapGrid';
import { Dashboard } from './components/Dashboard';
import { Controls } from './components/Controls';
import { SettingsMenu } from './components/SettingsMenu';
import { Leaderboard } from './components/Leaderboard';
import './index.css';

function App() {
    const { gameState, isRunning, togglePause, reset } = useGameSimulation();
    const [selectedHexId, setSelectedHexId] = useState<string | null>(null);

    return (
        <div className="h-screen w-screen flex bg-slate-950 overflow-hidden text-white font-sans">
            <Dashboard state={gameState} selectedHexId={selectedHexId} />
            <div className="flex-1 relative flex flex-col">
                <Controls isRunning={isRunning} onToggle={togglePause} onReset={reset} />
                <SettingsMenu />
                <MapGrid state={gameState} selectedHexId={selectedHexId} onSelectHex={setSelectedHexId} />
            </div>
            <div className="w-80 border-l border-slate-700 bg-slate-900 overflow-y-auto hidden lg:block">
                <Leaderboard state={gameState} />
            </div>
        </div>
    )
}
export default App
