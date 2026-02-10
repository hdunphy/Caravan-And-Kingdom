import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export const SettingsMenu: React.FC = () => {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-slate-800 text-slate-300 p-3 rounded-full border border-slate-600 hover:bg-slate-700 shadow-lg transition-all hover:scale-105"
                    title="Settings"
                >
                    <SettingsIcon size={24} />
                </button>
            </div>
            {showModal && <SettingsModal onClose={() => setShowModal(false)} />}
        </>
    );
};
