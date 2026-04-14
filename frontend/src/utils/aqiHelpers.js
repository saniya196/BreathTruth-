export const AQI_CATEGORIES = {
  good:         { label: 'Good',         color: '#22c55e', bg: '#dcfce7', range: '0–50' },
  satisfactory: { label: 'Satisfactory', color: '#84cc16', bg: '#f7fee7', range: '51–100' },
  moderate:     { label: 'Moderate',     color: '#eab308', bg: '#fefce8', range: '101–200' },
  poor:         { label: 'Poor',         color: '#f97316', bg: '#fff7ed', range: '201–300' },
  very_poor:    { label: 'Very Poor',    color: '#ef4444', bg: '#fef2f2', range: '301–400' },
  severe:       { label: 'Severe',       color: '#7c3aed', bg: '#f5f3ff', range: '401–500' },
  unknown:      { label: 'No Data',      color: '#94a3b8', bg: '#f8fafc', range: '—' },
};

export const CONFIDENCE_LEVELS = {
  low:      { label: 'Low Confidence',      color: '#94a3b8', icon: '○' },
  moderate: { label: 'Moderate Confidence', color: '#eab308', icon: '◑' },
  high:     { label: 'High Confidence',     color: '#22c55e', icon: '●' },
  verified: { label: 'Verified',            color: '#3b82f6', icon: '✓' },
};

export function getAqiCategory(aqi) {
  if (!aqi) return 'unknown';
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'satisfactory';
  if (aqi <= 200) return 'moderate';
  if (aqi <= 300) return 'poor';
  if (aqi <= 400) return 'very_poor';
  return 'severe';
}

export function getAqiColor(aqi) {
  return AQI_CATEGORIES[getAqiCategory(aqi)]?.color || '#94a3b8';
}

export function getAqiBg(aqi) {
  return AQI_CATEGORIES[getAqiCategory(aqi)]?.bg || '#f8fafc';
}

export function formatAqiLabel(aqi) {
  const cat = getAqiCategory(aqi);
  return AQI_CATEGORIES[cat]?.label || 'Unknown';
}

export const POLLUTION_SOURCES = [
  { value: 'traffic', label: '🚗 Traffic / Vehicles' },
  { value: 'construction', label: '🏗️ Construction / Dust' },
  { value: 'factory', label: '🏭 Factory / Industrial' },
  { value: 'burning', label: '🔥 Burning / Smoke' },
  { value: 'dust', label: '💨 Open Dust / Debris' },
  { value: 'mixed', label: '🌫️ Multiple Sources' },
  { value: 'unknown', label: '❓ Unknown' },
];

export const SYMPTOM_OPTIONS = [
  { value: 'eye_irritation', label: 'Eye Irritation' },
  { value: 'throat_irritation', label: 'Throat Irritation' },
  { value: 'coughing', label: 'Coughing' },
  { value: 'difficulty_breathing', label: 'Difficulty Breathing' },
  { value: 'headache', label: 'Headache' },
  { value: 'smell_pollution', label: 'Can Smell Pollution' },
  { value: 'visibility_reduced', label: 'Reduced Visibility/Haze' },
  { value: 'none', label: 'No Symptoms' },
];
