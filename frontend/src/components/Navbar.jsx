import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, Container } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BusinessIcon from '@mui/icons-material/Business';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" elevation={1} sx={{ backgroundColor: '#1E293B' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" component={RouterLink} to="/" sx={{ textDecoration: 'none', color: '#fff' }}>
            <ReceiptLongIcon sx={{ mr: 1.5, color: '#38BDF8', fontSize: 32 }} />
            <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
              BillGen Pro
            </Typography>
          </Box>

          {user && (
            <Box display="flex" alignItems="center" gap={1.5}>
              <Button
                component={RouterLink}
                to="/create"
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                sx={{
                  backgroundColor: '#38BDF8',
                  color: '#0F172A',
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#0284C7', color: '#fff' },
                  textTransform: 'none',
                }}
              >
                New Bill
              </Button>

              <Button
                component={RouterLink}
                to="/profile"
                color="inherit"
                startIcon={<BusinessIcon />}
                sx={{ textTransform: 'none', color: '#CBD5E1' }}
              >
                Billing Profile
              </Button>

              <Button
                component={RouterLink}
                to="/"
                color="inherit"
                sx={{ textTransform: 'none', color: '#CBD5E1' }}
              >
                Invoices
              </Button>

              <Box display="flex" alignItems="center" ml={1} gap={1}>
                {user.picture ? (
                  <Avatar src={user.picture} alt={user.name} sx={{ width: 34, height: 34 }} />
                ) : (
                  <Avatar sx={{ width: 34, height: 34, bgcolor: '#38BDF8', color: '#0F172A', fontWeight: 600 }}>
                    {user.name ? user.name[0] : 'U'}
                  </Avatar>
                )}
                <Button
                  onClick={handleLogout}
                  color="inherit"
                  size="small"
                  startIcon={<LogoutIcon fontSize="small" />}
                  sx={{ textTransform: 'none', color: '#94A3B8' }}
                >
                  Logout
                </Button>
              </Box>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
