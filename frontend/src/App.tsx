import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/store/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, PublicRoute } from '@/routes/guards';
import { Toaster } from 'react-hot-toast';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { PlayerDetailPage } from '@/pages/PlayerDetailPage';
import { PlayerFormPage } from '@/pages/PlayerFormPage';
import { EvaluationsPage } from '@/pages/EvaluationsPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { TeamsPage } from '@/pages/TeamsPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { MatchFormPage } from '@/pages/MatchFormPage';
import { StarsSystemPage } from '@/pages/StarsSystemPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { RegulationPage } from '@/pages/RegulationPage';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="players/new" element={<PlayerFormPage />} />
              <Route path="players/:id" element={<PlayerDetailPage />} />
              <Route path="players/:id/edit" element={<PlayerFormPage />} />
              <Route path="evaluations" element={<EvaluationsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="teams" element={<TeamsPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="matches/new" element={<MatchFormPage />} />
              <Route path="stars-system" element={<StarsSystemPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="regulation" element={<RegulationPage />} />
            </Route>

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#18181B',
              color: '#F4F4F5',
              border: '1px solid #27272A',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#16A34A', secondary: '#F4F4F5' },
            },
            error: {
              iconTheme: { primary: '#D90429', secondary: '#F4F4F5' },
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
