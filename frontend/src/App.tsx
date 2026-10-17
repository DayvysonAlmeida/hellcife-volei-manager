import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/store/AuthContext';
import { ThemeProvider } from '@/store/ThemeContext';
import { queryClient } from '@/lib/queryClient';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminRoute, PlayerRoute, PublicRoute } from '@/routes/guards';
import { Toaster } from 'react-hot-toast';
import { PageLoading } from '@/components/ui/Loading';

// Lazy loading — cada página é carregada apenas quando visitada
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PlayersPage = lazy(() => import('@/pages/PlayersPage').then(m => ({ default: m.PlayersPage })));
const PlayerDetailPage = lazy(() => import('@/pages/PlayerDetailPage').then(m => ({ default: m.PlayerDetailPage })));
const PlayerFormPage = lazy(() => import('@/pages/PlayerFormPage').then(m => ({ default: m.PlayerFormPage })));
const EvaluationsPage = lazy(() => import('@/pages/EvaluationsPage').then(m => ({ default: m.EvaluationsPage })));
const AttendancePage = lazy(() => import('@/pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const AttendanceTrackingPage = lazy(() => import('@/pages/AttendanceTrackingPage').then(m => ({ default: m.AttendanceTrackingPage })));
const CourtCheckinPage = lazy(() => import('@/pages/CourtCheckinPage').then(m => ({ default: m.CourtCheckinPage })));
const TeamsPage = lazy(() => import('@/pages/TeamsPage').then(m => ({ default: m.TeamsPage })));
const MatchesPage = lazy(() => import('@/pages/MatchesPage').then(m => ({ default: m.MatchesPage })));
const MatchFormPage = lazy(() => import('@/pages/MatchFormPage').then(m => ({ default: m.MatchFormPage })));
const StarsSystemPage = lazy(() => import('@/pages/StarsSystemPage').then(m => ({ default: m.StarsSystemPage })));
const SeasonsPage = lazy(() => import('@/pages/SeasonsPage').then(m => ({ default: m.SeasonsPage })));
const HallOfFamePage = lazy(() => import('@/pages/HallOfFamePage').then(m => ({ default: m.HallOfFamePage })));
const EloSystemPage = lazy(() => import('@/pages/EloSystemPage').then(m => ({ default: m.EloSystemPage })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const AdminSubscriptionsPage = lazy(() => import('@/pages/subscriptions/AdminSubscriptionsPage').then(m => ({ default: m.AdminSubscriptionsPage })));
const AdminPlansPage = lazy(() => import('@/pages/subscriptions/AdminPlansPage').then(m => ({ default: m.AdminPlansPage })));
const FinanceDashboardPage = lazy(() => import('@/pages/subscriptions/FinanceDashboardPage').then(m => ({ default: m.FinanceDashboardPage })));
const RegulationPage = lazy(() => import('@/pages/RegulationPage').then(m => ({ default: m.RegulationPage })));
const CircuitFinancePage = lazy(() => import('@/pages/finance/CircuitFinancePage').then(m => ({ default: m.CircuitFinancePage })));
const RegulationAdminPage = lazy(() => import('@/pages/RegulationAdminPage').then(m => ({ default: m.RegulationAdminPage })));
const CheckinPage = lazy(() => import('@/pages/CheckinPage').then(m => ({ default: m.CheckinPage })));
const BracketPage = lazy(() => import('@/pages/BracketPage').then(m => ({ default: m.BracketPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

// Portal do Atleta
const AthleteDashboardPage = lazy(() => import('@/pages/athlete/AthleteDashboardPage').then(m => ({ default: m.AthleteDashboardPage })));
const MyProfilePage = lazy(() => import('@/pages/athlete/MyProfilePage').then(m => ({ default: m.MyProfilePage })));
const AthleteCheckinPage = lazy(() => import('@/pages/athlete/AthleteCheckinPage').then(m => ({ default: m.AthleteCheckinPage })));
const AthleteMatchesPage = lazy(() => import('@/pages/athlete/AthleteMatchesPage').then(m => ({ default: m.AthleteMatchesPage })));
const PlansPage = lazy(() => import('@/pages/subscriptions/PlansPage').then(m => ({ default: m.PlansPage })));
const WalletPage = lazy(() => import('@/pages/athlete/WalletPage').then(m => ({ default: m.WalletPage })));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
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
            
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              }
            />
            
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPasswordPage />
                </PublicRoute>
              }
            />
            
            <Route path="/checkin/:id" element={<CheckinPage />} />

            {/* ── Portal do Atleta ────────────────────────────────── */}
            <Route
              path="/athlete"
              element={
                <PlayerRoute>
                  <AppLayout />
                </PlayerRoute>
              }
            >
              <Route index element={<AthleteDashboardPage />} />
              <Route path="profile" element={<MyProfilePage />} />
              <Route path="checkin" element={<AthleteCheckinPage />} />
              <Route path="matches" element={<AthleteMatchesPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="regulation" element={<RegulationPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="elo-system" element={<EloSystemPage />} />
              <Route path="seasons" element={<SeasonsPage />} />
              <Route path="hall-of-fame" element={<HallOfFamePage />} />
            </Route>

            {/* ── Painel Admin / Moderador ────────────────────────── */}
            <Route
              path="/"
              element={
                <AdminRoute>
                  <AppLayout />
                </AdminRoute>
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
              <Route path="attendance/tracking" element={<AttendanceTrackingPage />} />
              <Route path="court-checkin" element={<CourtCheckinPage />} />
              <Route path="teams" element={<TeamsPage />} />
              <Route path="bracket/:id" element={<BracketPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="matches/new" element={<MatchFormPage />} />
              <Route path="matches/:id/edit" element={<MatchFormPage />} />
              <Route path="stars-system" element={<StarsSystemPage />} />
              <Route path="elo-system" element={<EloSystemPage />} />
              <Route path="seasons" element={<SeasonsPage />} />
              <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
              <Route path="plans" element={<AdminPlansPage />} />
              <Route path="finance" element={<FinanceDashboardPage />} />
              <Route path="finance/circuits" element={<CircuitFinancePage />} />
              <Route path="regulation" element={<RegulationPage />} />
              <Route path="regulation/edit" element={<RegulationAdminPage />} />
              <Route path="hall-of-fame" element={<HallOfFamePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster
          position="bottom-center"
          toastOptions={{
            // As cores do tema são "R G B" (ex.: "13 15 20"): precisam do rgb(), senão o aviso fica transparente
            style: {
              background: 'rgb(var(--color-surface))',
              color: 'rgb(var(--color-text-primary))',
              border: '1px solid rgb(var(--color-border) / 0.5)',
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
