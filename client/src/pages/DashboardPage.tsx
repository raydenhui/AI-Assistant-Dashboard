import { Header } from '../components/layout/Header';
import { InboxWidget } from '../components/dashboard/InboxWidget';
import { TasksWidget } from '../components/dashboard/TasksWidget';
import { ScheduleWidget } from '../components/dashboard/ScheduleWidget';
import { ChatPanel } from '../components/chat/ChatPanel';

export function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 flex p-5 gap-5">
        {/* Dashboard Panel (Left) */}
        <div className="flex-[3] flex flex-col gap-5">
          <InboxWidget />
          <TasksWidget />
          <ScheduleWidget />
        </div>

        {/* Chat Panel (Right) */}
        <div className="flex-[2]">
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
