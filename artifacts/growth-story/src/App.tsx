import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import Home from './pages/Home';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminUsers from './pages/AdminUsers';
import AdminUserDetail from './pages/AdminUsersUserId';
import AdminUserDaily from './pages/AdminUsersUserIdDaily';
import AdminUserDailyDate from './pages/AdminUsersUserIdDailyDate';
import AdminUserGoals from './pages/AdminUsersUserIdGoals';
import AdminUserStory from './pages/AdminUsersUserIdStory';
import AdminUserStoryVersion from './pages/AdminUsersUserIdStoryVersionId';
import ForgotPassword from './pages/Forgot-password';
import ResetPassword from './pages/Reset-password';
import Register from './pages/Register';
import Daily from './pages/Daily';
import Goals from './pages/Goals';
import StoryEdit from './pages/StoryEdit';
import StoryHistory from './pages/StoryHistory';
import StoryHistoryVersion from './pages/StoryHistoryVersionId';
import StoryView from './pages/Story';
import Timeline from './pages/Timeline';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/users/:userId" component={AdminUserDetail} />
        <Route path="/admin/users/:userId/daily" component={AdminUserDaily} />
        <Route path="/admin/users/:userId/daily/:date" component={AdminUserDailyDate} />
        <Route path="/admin/users/:userId/goals" component={AdminUserGoals} />
        <Route path="/admin/users/:userId/story" component={AdminUserStory} />
        <Route path="/admin/users/:userId/story/:versionId" component={AdminUserStoryVersion} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/register" component={Register} />
        <Route path="/daily" component={Daily} />
        <Route path="/goals" component={Goals} />
        <Route path="/story" component={StoryView} />
        <Route path="/story/edit" component={StoryEdit} />
        <Route path="/story/history" component={StoryHistory} />
        <Route path="/story/history/:versionId" component={StoryHistoryVersion} />
        <Route path="/timeline" component={Timeline} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;