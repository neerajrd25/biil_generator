import React, { useState } from 'react';
import { Box, Paper, Typography, Container, Alert, Button } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SecurityIcon from '@mui/icons-material/Security';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import { brandGradient } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';

export default function LoginPage() {
  const { user, loading, sessionMessage, loginWithCredential } = useAuth();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Already signed in (e.g. pressed Back to the login page): go straight to the app.
  if (!loading && user) return <Navigate to={redirectTo} replace />;

  const handleSuccess = async (credentialResponse) => {
    try {
      if (credentialResponse.credential) {
        await loginWithCredential(credentialResponse.credential);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google Sign-In failed');
    }
  };

  const handleDevBypass = async () => {
    try {
      await loginWithCredential('mock-dev-token');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError('Dev login requires backend DEV_BYPASS_AUTH=true in .env');
    }
  };

  const features = [
    { icon: <PeopleOutlineIcon />, text: 'Client-wise financial dashboards' },
    { icon: <LockOutlinedIcon />, text: 'Lock invoices once they are final' },
    { icon: <BrushOutlinedIcon />, text: 'Branded PDFs with your logo' },
  ];

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', px: 2, py: 4, position: 'relative', overflow: 'hidden',
        '&::before': { content: '""', position: 'absolute', width: 420, height: 420, borderRadius: '50%', top: -120, left: -100, background: 'radial-gradient(circle, rgba(79,70,229,0.35), transparent 70%)' },
        '&::after': { content: '""', position: 'absolute', width: 460, height: 460, borderRadius: '50%', bottom: -160, right: -120, background: 'radial-gradient(circle, rgba(236,72,153,0.30), transparent 70%)' },
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 5, textAlign: 'center', backdropFilter: 'blur(14px)', bgcolor: 'rgba(255,255,255,0.85)' }}>
          <Box sx={{ width: 76, height: 76, mx: 'auto', mb: 2, borderRadius: 4, display: 'grid', placeItems: 'center', background: brandGradient, boxShadow: '0 14px 30px rgba(79,70,229,0.4)' }}>
            <ReceiptLongIcon sx={{ fontSize: 40, color: '#fff' }} />
          </Box>
          <Typography variant="h4" gutterBottom sx={{ background: brandGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            BillGen Pro
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Beautiful invoices, clear client finances. Sign in to get started.
          </Typography>

          {sessionMessage && !error && (
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              {sessionMessage}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Box display="flex" justifyContent="center" mb={3}>
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Google Authentication Failed')}
              useOneTap
              shape="pill"
              theme="filled_blue"
              size="large"
              text="signin_with"
            />
          </Box>

          <Box display="flex" flexDirection="column" gap={1.25} alignItems="flex-start" mt={4} pt={3} borderTop="1px solid rgba(99,102,241,0.15)">
            {features.map((f) => (
              <Box key={f.text} display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ width: 32, height: 32, borderRadius: 2, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'rgba(79,70,229,0.1)', '& svg': { fontSize: 18 } }}>{f.icon}</Box>
                <Typography variant="body2" color="text.secondary">{f.text}</Typography>
              </Box>
            ))}
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box sx={{ width: 32, height: 32, borderRadius: 2, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'rgba(79,70,229,0.1)' }}><SecurityIcon sx={{ fontSize: 18 }} /></Box>
              <Typography variant="body2" color="text.secondary">Secure Google sign-in</Typography>
            </Box>
          </Box>

          {import.meta.env.DEV && (
            <Box mt={3}>
              <Button size="small" variant="text" color="secondary" onClick={handleDevBypass}>
                (Dev Mode: Quick Bypass Sign-In)
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
