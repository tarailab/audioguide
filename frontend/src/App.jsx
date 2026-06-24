import { useState, useEffect } from 'react';
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

  // ?admin=1 / ?admin=0 still toggles the testing overlay.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('admin');
    if (p === '1' || p === '0') updatePrefs({ ...prefs, admin: p === '1' });
  }, []);

  return screen === 'journey'
    ? <JourneyScreen prefs={prefs} onOpenPrefs={() => setScreen('prefs')} />
    : <PreferencesScreen prefs={prefs} onChange={updatePrefs} onBack={() => setScreen('journey')} />;
}
