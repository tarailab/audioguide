const KEY = 'audioguide-prefs';

export const DEFAULTS = {
  interests: ['history', 'architecture', 'nature'],
  tone: 'storyteller',
  length: '1min',
  density: 'normal',
  language: 'en',
  storyProvider: 'claude',
};

export const INTEREST_OPTIONS = [
  { id: 'history',      label: 'History' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'nature',       label: 'Nature' },
  { id: 'mythology',    label: 'Mythology' },
  { id: 'darkhistory',  label: 'Dark History' },
  { id: 'military',     label: 'Military' },
  { id: 'locallife',    label: 'Local Life' },
];

export function loadPreferences() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(prefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
