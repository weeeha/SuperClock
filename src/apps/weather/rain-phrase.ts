import { conditionLabel, type WeatherModel } from './weather-utils';

/** At or above this precipitation probability an hour counts as wet. The
 *  Fields skin's hourly panel draws the same threshold, so the sentence and
 *  the bars never disagree. */
export const WET = 50;

export interface RainPhrase {
  /** "Overcast, rain from 15:00": the condition, plus the next change in the
   *  hourly window when there is one. */
  sentence: string;
  /** The one word the Fields skin sets in italic, or null when the sentence
   *  is only the condition. */
  emphasis: string | null;
}

function sentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

/** One plain sentence for the Fields skin's Now screen. Reads the hourly
 *  window `parseForecast` keeps (up to 12 hours from now); says nothing it
 *  cannot see in that window. */
export function rainPhrase(model: WeatherModel): RainPhrase {
  const condition = sentenceCase(conditionLabel(model.current.code));
  const wetNow = model.current.precipProb >= WET;
  const ahead = model.hours.slice(1);
  const change = ahead.find((h) => (h.precipProb >= WET) !== wetNow);
  if (!change) return { sentence: condition, emphasis: null };
  const at = `${String(change.hour).padStart(2, '0')}:00`;
  return wetNow
    ? { sentence: `${condition}, clearing by ${at}`, emphasis: 'clearing' }
    : { sentence: `${condition}, rain from ${at}`, emphasis: 'rain' };
}
