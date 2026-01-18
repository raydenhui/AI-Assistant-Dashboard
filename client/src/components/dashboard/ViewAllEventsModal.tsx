import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { calendarApi } from '../../services/api';
import { toast } from '../common/Toast';
import type { CalendarEvent } from '../../types';

interface ViewAllEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DayEvents {
  date: string;
  dateLabel: string;
  events: CalendarEvent[];
}

export function ViewAllEventsModal({ isOpen, onClose }: ViewAllEventsModalProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [daysToShow, setDaysToShow] = useState(7);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await calendarApi.list({ days: daysToShow });
      setEvents(data);
    } catch (error) {
      toast.error('Failed to fetch events');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [daysToShow]);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen, fetchEvents]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const result = await calendarApi.sync(daysToShow);
      toast.success(`Synced ${result.synced} events`);
      fetchEvents();
    } catch (error) {
      toast.error('Failed to sync calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  // Group events by day
  const groupEventsByDay = (events: CalendarEvent[]): DayEvents[] => {
    const groups: Map<string, CalendarEvent[]> = new Map();
    
    events.forEach((event) => {
      const date = new Date(event.startTime).toDateString();
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(event);
    });

    const result: DayEvents[] = [];
    groups.forEach((dayEvents, date) => {
      const dateObj = new Date(date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let dateLabel: string;
      if (dateObj.toDateString() === today.toDateString()) {
        dateLabel = 'Today';
      } else if (dateObj.toDateString() === tomorrow.toDateString()) {
        dateLabel = 'Tomorrow';
      } else {
        dateLabel = dateObj.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
      }

      result.push({
        date,
        dateLabel,
        events: dayEvents.sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        ),
      });
    });

    return result.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getLocationIcon = (location: string | null) => {
    if (!location) return 'fa-calendar';
    if (location.toLowerCase().includes('meet') || location.toLowerCase().includes('zoom')) {
      return 'fa-video';
    }
    return 'fa-map-marker-alt';
  };

  const groupedEvents = groupEventsByDay(events);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Calendar" size="xl">
      <div className="flex flex-col h-[60vh]">
        {/* Actions */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={daysToShow}
              onChange={(e) => setDaysToShow(Number(e.target.value))}
              className="form-select py-1.5 text-sm"
              aria-label="Select time range"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="btn btn-secondary text-sm"
          >
            {isSyncing ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Syncing...</>
            ) : (
              <><i className="fas fa-sync-alt mr-2"></i>Sync Calendar</>
            )}
          </button>
        </div>

        {/* Events List / Detail View */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Events List */}
          <div className={`${selectedEvent ? 'w-2/5' : 'w-full'} overflow-auto`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="spinner w-8 h-8"></div>
              </div>
            ) : groupedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
                <i className="fas fa-calendar-check text-4xl mb-3"></i>
                <p>No events scheduled</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedEvents.map((group) => (
                  <div key={group.date}>
                    <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg sticky top-0">
                      {group.dateLabel}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {group.events.map((event) => (
                        <li 
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`
                            p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors
                            ${selectedEvent?.id === event.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-gray-200'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-sm font-medium text-primary w-16 flex-shrink-0">
                              {formatTime(event.startTime)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {event.title}
                              </p>
                              {event.location && (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                  <i className={`fas ${getLocationIcon(event.location)} text-xs`}></i>
                                  <span className="truncate">{event.location}</span>
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDuration(event.startTime, event.endTime)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Detail */}
          {selectedEvent && (
            <div className="w-3/5 border border-gray-200 rounded-lg p-4 overflow-auto">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-gray-500 hover:text-gray-700 mb-4 md:hidden"
              >
                <i className="fas fa-arrow-left mr-2"></i>Back
              </button>

              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {selectedEvent.title}
              </h3>

              {/* Time Info */}
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <i className="fas fa-clock text-gray-400"></i>
                <div>
                  <p className="font-medium">
                    {new Date(selectedEvent.startTime).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm">
                    {formatTime(selectedEvent.startTime)} - {formatTime(selectedEvent.endTime)}
                    <span className="text-gray-400 ml-2">
                      ({formatDuration(selectedEvent.startTime, selectedEvent.endTime)})
                    </span>
                  </p>
                </div>
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-gray-600 mb-3">
                  <i className={`fas ${getLocationIcon(selectedEvent.location)} text-gray-400`}></i>
                  <a 
                    href={selectedEvent.location.includes('http') ? selectedEvent.location : `#`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {selectedEvent.location}
                  </a>
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <i className="fas fa-users text-gray-400"></i>
                    <span className="font-medium">
                      {selectedEvent.attendees.length} Attendee{selectedEvent.attendees.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {selectedEvent.attendees.slice(0, 5).map((attendee, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className={`
                          w-2 h-2 rounded-full
                          ${attendee.responseStatus === 'accepted' ? 'bg-green-500' :
                            attendee.responseStatus === 'declined' ? 'bg-red-500' :
                            attendee.responseStatus === 'tentative' ? 'bg-yellow-500' :
                            'bg-gray-300'}
                        `}></span>
                        {attendee.name || attendee.email}
                      </li>
                    ))}
                    {selectedEvent.attendees.length > 5 && (
                      <li className="text-sm text-gray-400">
                        +{selectedEvent.attendees.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* AI Analysis */}
              {selectedEvent.aiAnalysis?.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-blue-700 text-sm font-medium mb-1">
                    <i className="fas fa-robot"></i>
                    AI Summary
                  </div>
                  <p className="text-sm text-blue-800">{selectedEvent.aiAnalysis.summary}</p>
                </div>
              )}

              {selectedEvent.aiAnalysis?.preparationNotes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-1">
                    <i className="fas fa-clipboard-check"></i>
                    Preparation Notes
                  </div>
                  <p className="text-sm text-green-800">{selectedEvent.aiAnalysis.preparationNotes}</p>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <div 
                    className="text-sm text-gray-600 whitespace-pre-wrap prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ViewAllEventsModal;
