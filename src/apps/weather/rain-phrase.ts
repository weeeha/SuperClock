import { conditionLabel, type WeatherModel } from './weather-utils';

/** At or above this precipitation probability an hour counts as wet. */
export const WET = 50;

export interface RainPhrase {
  /** The condition now, as the model names it ("Overcast", "Partly Cloudy"). */
  condition: string;
  /** The next change in the hourly window ("Rain from 15:00", "Clearing by
   *  18:00"), or null when the window holds no change. */
  change: string | null;
}

/** The Fields skin's two lines under the temperature. Reads the hourly window
 *  `parseForecast` keeps (up to 12 hours from now) and says nothing it cannot
 *  see in that window. */
export function rainPhrase(model: WeatherModel): RainPhrase {
  const condition = conditionLabel(model.current.code);
  const wetNow = model.current.precipProb >= WET;
  const next = model.hours.slice(1).find((h) => (h.precipProb >= WET) !== wetNow);
  if (!next) return { condition, change: null };
  const at = `${String(next.hour).padStart(2, '0')}:00`;
  return { condition, change: wetNow ? `Clearing by ${at}` : `Rain from ${at}` };
}
