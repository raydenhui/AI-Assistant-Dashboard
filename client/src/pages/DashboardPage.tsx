import { Header } from '../components/layout/Header';
import { InboxWidget } from '../components/dashboard/InboxWidget';
import { TasksWidget } from '../components/dashboard/TasksWidget';
import { ScheduleWidget } from '../components/dashboard/ScheduleWidget';
import { ChatPanel } from '../components/chat/ChatPanel';

export function DashboardPage() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      
      <main className="flex-1 flex p-5 gap-5 overflow-hidden min-h-0">
        {/* Dashboard Panel (Left) */}
        <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-2 min-h-0">
          <InboxWidget />
          <TasksWidget />
          <ScheduleWidget />
        </div>

        {/* Chat Panel (Right) */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
