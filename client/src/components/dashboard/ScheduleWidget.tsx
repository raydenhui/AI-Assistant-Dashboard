import { useState, useRef } from 'react';
import { calendarApi } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import { toast } from '../common/Toast';
import { ViewAllEventsModal } from './ViewAllEventsModal';
import type { CalendarEvent } from '../../types';

// Polling interval: 1 minute (60000ms)
const POLL_INTERVAL = 1 * 60 * 1000;

export function ScheduleWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showViewAll, setShowViewAll] = useState(false);
  const hasShownError = useRef(false);

  // Use polling hook for auto-refresh
  const { lastUpdated, refresh } = usePolling(
    async () => {
      try {
        setIsLoading(true);
        const data = await calendarApi.getToday();
        setEvents(data);
        setError(null);
        hasShownError.current = false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch events';
        setError(message);
        if (!hasShownError.current) {
          hasShownError.current = true;
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    {
      interval: POLL_INTERVAL,
      enabled: true,
      immediate: true,
    }
  );

  const handleDismiss = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    toast.info('Event hidden from today\'s view');
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

  const isHappeningNow = (startTime: string, endTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    return now >= start && now <= end;
  };

  const isUpcoming = (startTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const diffMins = Math.floor((start.getTime() - now.getTime()) / 60000);
    return diffMins > 0 && diffMins <= 30;
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <>
      <div className="widget h-full flex flex-col">
        <div className="widget-header !mb-2 !pb-1.5 flex-col !items-start">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="dark:text-white whitespace-nowrap text-base">Schedule</span>
              {events.length > 0 && (
                <span className="text-[10px] bg-primary text-white px-1.5 py-0 rounded-full">
                  {events.length}
                </span>
              )}
              {lastUpdated && (
                <span className="text-[10px] text-gray-400 font-normal dark:text-slate-500 ml-1">
                  {formatLastUpdated(lastUpdated)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
                className="text-gray-400 hover:text-primary transition-colors dark:text-slate-500 dark:hover:text-primary"
                title="Refresh"
              >
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
              <button
                onClick={() => setShowViewAll(true)}
                className="text-primary hover:underline text-xs font-medium whitespace-nowrap"
              >
                View All
              </button>
            </div>
          </div>
        </div>

        {isLoading && events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-500 dark:text-slate-400">
            <i className="fas fa-exclamation-circle text-danger text-2xl mb-2"></i>
            <p className="text-sm">{error}</p>
            <button onClick={() => refresh()} className="text-primary text-sm mt-2 hover:underline">
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-500 dark:text-slate-400">
            <i className="fas fa-calendar-check text-3xl mb-2"></i>
            <p>No events scheduled for today</p>
            <button
              onClick={() => setShowViewAll(true)}
              className="text-primary text-sm mt-2 hover:underline"
            >
              View upcoming events
            </button>
          </div>
        ) : (
          <ul className="widget-content divide-y divide-border">
            {sortedEvents.slice(0, 4).map((event) => {
              const happeningNow = isHappeningNow(event.startTime, event.endTime);
              const comingUp = isUpcoming(event.startTime);
              
              return (
                <li 
                  key={event.id} 
                  className={`py-3 first:pt-0 last:pb-0 group ${
                    happeningNow ? 'bg-primary/5 -mx-5 px-5 rounded-lg dark:bg-primary/10' : ''
                  }`}
                >
                  {/* Status indicator */}
                  {happeningNow && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mb-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                      Happening now
                    </span>
                  )}
                  {comingUp && !happeningNow && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning font-medium mb-1">
                      <i className="fas fa-clock"></i>
                      Starting soon
                    </span>
                  )}
                  
                  {/* Main row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Time */}
                      <span className={`text-sm font-medium w-20 flex-shrink-0 ${
                        happeningNow ? 'text-primary' : 'text-gray-600 dark:text-slate-400'
                      }`}>
                        {formatTime(event.startTime)}
                      </span>
                      
                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800 block truncate dark:text-slate-200">
                          {event.title}
                        </span>
                        {event.location && (
                          <span className="text-sm text-gray-500 flex items-center gap-1 mt-0.5 dark:text-slate-400">
                            <i className={`fas ${getLocationIcon(event.location)} text-xs`}></i>
                            <span className="truncate">{event.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDismiss(event.id)}
                      className="delete-btn opacity-0 group-hover:opacity-100 transition-opacity dark:text-slate-500 dark:hover:text-danger"
                      aria-label="Dismiss event"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                  
                  {/* AI Summary */}
                  {event.aiAnalysis?.summary && (
                    <p className="text-sm text-gray-500 italic mt-2 ml-[5.5rem] leading-relaxed line-clamp-2 dark:text-slate-400">
                      AI Summary: {event.aiAnalysis.summary}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Show count if more events */}
        {events.length > 4 && (
          <button 
            onClick={() => setShowViewAll(true)}
            className="w-full text-center text-sm text-primary hover:underline mt-3 pt-3 border-t border-border"
          >
            +{events.length - 4} more events today
          </button>
        )}
      </div>

      {/* View All Modal */}
      <ViewAllEventsModal isOpen={showViewAll} onClose={() => setShowViewAll(false)} />
    </>
  );
}

export default ScheduleWidget;
