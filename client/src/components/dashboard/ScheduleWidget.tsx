import { useEffect, useState } from 'react';
import { calendarApi } from '../../services/api';
import type { CalendarEvent } from '../../types';

export function ScheduleWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const data = await calendarApi.getToday();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getLocationIcon = (location: string | null) => {
    if (!location) return 'fa-calendar';
    if (location.toLowerCase().includes('meet') || location.toLowerCase().includes('zoom')) {
      return 'fa-video';
    }
    return 'fa-map-marker-alt';
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <span>Upcoming Schedule</span>
        <button className="text-primary hover:underline text-sm font-medium">
          View Full Calendar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-exclamation-circle text-danger mb-2"></i>
          <p>{error}</p>
          <button onClick={fetchEvents} className="text-primary text-sm mt-2 hover:underline">
            Try again
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-calendar-check text-3xl mb-2"></i>
          <p>No events scheduled for today</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((event) => (
            <li key={event.id} className="py-3 first:pt-0 last:pb-0">
              {/* Main row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {/* Time */}
                  <span className="text-sm font-medium text-primary w-20 flex-shrink-0">
                    {formatTime(event.startTime)}
                  </span>
                  
                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 block truncate">
                      {event.title}
                    </span>
                    {event.location && (
                      <span className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <i className={`fas ${getLocationIcon(event.location)} text-xs`}></i>
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => handleDismiss(event.id)}
                  className="delete-btn"
                  aria-label="Dismiss event"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              
              {/* AI Summary */}
              {event.aiAnalysis?.summary && (
                <p className="text-sm text-gray-500 italic mt-2 ml-[5.5rem] leading-relaxed">
                  AI Summary: {event.aiAnalysis.summary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ScheduleWidget;
