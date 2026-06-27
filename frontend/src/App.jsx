import { useState, useEffect } from 'react';
import JourneyScreen from './pages/JourneyScreen';
import PreferencesScreen from './pages/PreferencesScreen';
import TripPlanner from './pages/TripPlanner';
import { loadPreferences, savePreferences } from './store/preferences';

const SCREENS = ['journey', 'planner', 'prefs'];

// Start on the screen named in ?screen=… so the planner is directly linkable
// (e.g. https://…:8443/?screen=planner).
function initialScreen() {
  const s = new URLSearchParams(window.location.search).get('screen');
  return SCREENS.includes(s) ? s : 'journey';
}

export default function App() {
  const [screen, setScreen] = useState(initialScreen);
  const [prefs, setPrefs] = useState(loadPreferences);

  const updatePrefs = (next) => {
    setPrefs(next);
    savePreferences(next);
  };

  // Navigate + keep the URL in sync so the current screen stays linkable/refreshable.
  const go = (next) => {
    setScreen(next);
    const url = new URL(window.location.href);
    if (next === 'journey') url.searchParams.delete('screen');
    else url.searchParams.set('screen', next);
    window.history.replaceState(null, '', url);
  };

  // ?admin=1 / ?admin=0 still toggles the testing overlay.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('admin');
    if (p === '1' || p === '0') updatePrefs({ ...prefs, admin: p === '1' });
  }, []);

  if (screen === 'planner') {
    return <TripPlanner onBack={() => go('journey')} onOpenPrefs={() => go('prefs')} />;
  }
  if (screen === 'prefs') {
    return <PreferencesScreen prefs={prefs} onChange={updatePrefs} onBack={() => go('journey')} />;
  }
  return (
    <JourneyScreen
      prefs={prefs}
      onOpenPrefs={() => go('prefs')}
      onOpenPlanner={() => go('planner')}
    />
  );
}
