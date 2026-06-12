import { INTEREST_OPTIONS } from '../store/preferences';

export default function PreferencesScreen({ prefs, onChange, onBack }) {
  const toggle = (field, value) => {
    const arr = prefs[field];
    const updated = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...prefs, [field]: updated });
  };

  const set = (field, value) => onChange({ ...prefs, [field]: value });

  return (
    <div className="screen prefs-screen">
      <div className="prefs-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1>Preferences</h1>
      </div>

      <section className="pref-section">
        <h2>Interests</h2>
        <div className="pill-grid">
          {INTEREST_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`pill-toggle ${prefs.interests.includes(opt.id) ? 'active' : ''}`}
              onClick={() => toggle('interests', opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="pref-section">
        <h2>Language</h2>
        <div className="btn-group">
          {[['en', '🇬🇧 English'], ['lt', '🇱🇹 Lithuanian']].map(([val, label]) => (
            <button
              key={val}
              className={`group-btn ${prefs.language === val ? 'active' : ''}`}
              onClick={() => set('language', val)}
            >{label}</button>
          ))}
        </div>
      </section>

      <section className="pref-section">
        <h2>Story Length</h2>
        <div className="btn-group">
          {[['30s', '30 sec'], ['1min', '1 min'], ['3min', '3 min'], ['5min', '5 min']].map(([val, label]) => (
            <button
              key={val}
              className={`group-btn ${prefs.length === val ? 'active' : ''}`}
              onClick={() => set('length', val)}
            >{label}</button>
          ))}
        </div>
      </section>

      <section className="pref-section">
        <h2>Story Density</h2>
        <div className="btn-group">
          {[['sparse', 'Sparse (~20 min)'], ['normal', 'Normal (~8 min)'], ['rich', 'Rich (~3 min)']].map(([val, label]) => (
            <button
              key={val}
              className={`group-btn ${prefs.density === val ? 'active' : ''}`}
              onClick={() => set('density', val)}
            >{label}</button>
          ))}
        </div>
      </section>

      <section className="pref-section">
        <h2>Tone</h2>
        <div className="btn-group">
          {[['storyteller', 'Storyteller'], ['scholarly', 'Scholarly'], ['casual', 'Casual']].map(([val, label]) => (
            <button
              key={val}
              className={`group-btn ${prefs.tone === val ? 'active' : ''}`}
              onClick={() => set('tone', val)}
            >{label}</button>
          ))}
        </div>
      </section>

      <section className="pref-section">
        <h2>Story Engine</h2>
        <div className="btn-group">
          {[['claude', 'Claude (best)'], ['openai', 'GPT-4o'], ['ollama', 'Local (free)']].map(([val, label]) => (
            <button
              key={val}
              className={`group-btn ${prefs.storyProvider === val ? 'active' : ''}`}
              onClick={() => set('storyProvider', val)}
            >{label}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
