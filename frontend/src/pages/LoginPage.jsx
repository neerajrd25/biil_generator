import React, { useState } from 'react';
import { Box, Paper, Typography, Container, Alert, Button } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SecurityIcon from '@mui/icons-material/Security';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { loginWithCredential } = useAuth();
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      if (credentialResponse.credential) {
        await loginWithCredential(credentialResponse.credential);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google Sign-In failed');
    }
  };

  const handleDevBypass = async () => {
    try {
      await loginWithCredential('mock-dev-token');
      navigate('/');
    } catch (err) {
      setError('Dev login requires backend DEV_BYPASS_AUTH=true in .env');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
        <Box display="inline-flex" p={2} bgcolor="#EFF6FF" borderRadius="50%" mb={2}>
          <ReceiptLongIcon sx={{ fontSize: 48, color: '#0284C7' }} />
        </Box>
        <Typography variant="h4" fontWeight={700} color="#0F172A" gutterBottom>
          BillGen Pro
        </Typography>
        <Typography variant="body1" color="#64748B" mb={4}>
          Sign in to manage your billing profile, clients, create bills, and download PDFs stored in MongoDB.
        </Typography>

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

        <Box display="flex" justifyContent="space-around" mt={4} pt={3} borderTop="1px solid #E2E8F0">
          <Box display="flex" alignItems="center" gap={1}>
            <SecurityIcon fontSize="small" sx={{ color: '#0284C7' }} />
            <Typography variant="caption" color="#64748B">Secure Token Verification</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <CloudQueueIcon fontSize="small" sx={{ color: '#0284C7' }} />
            <Typography variant="caption" color="#64748B">MongoDB GridFS Storage</Typography>
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
  );
}
