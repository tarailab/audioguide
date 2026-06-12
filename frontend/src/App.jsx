import { useState } from 'react';
import JourneyScreen from './pages/JourneyScreen';
import PreferencesScreen from './pages/PreferencesScreen';
import { loadPreferences, savePreferences } from './store/preferences';

export default function App() {
  const [screen, setScreen] = useState('journey');
  const [prefs, setPrefs] = useState(loadPreferences);

  const updatePrefs = (next) => {
    setPrefs(next);
    savePreferences(next);
  };

  return screen === 'journey'
    ? <JourneyScreen prefs={prefs} onOpenPrefs={() => setScreen('prefs')} />
    : <PreferencesScreen prefs={prefs} onChange={updatePrefs} onBack={() => setScreen('journey')} />;
}
