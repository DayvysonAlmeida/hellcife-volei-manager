import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/store/AuthContext';
import { ThemeProvider } from '@/store/ThemeContext';
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
import { CheckinPage } from '@/pages/CheckinPage';
import { BracketPage } from '@/pages/BracketPage';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
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
            
            <Route path="/checkin/:id" element={<CheckinPage />} />

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
              <Route path="bracket/:id" element={<BracketPage />} />
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
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
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
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
