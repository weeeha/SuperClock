export interface CalendarEvent {
  start: string;
  end: string;
  title: string;
  allDay: boolean;
  uid: string;
  location?: string;
  description?: string;
  category?: string;
}
