import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, Container, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Link as RouterLink, NavLink, useNavigate } from 'react-router-dom';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Invoices', icon: <ReceiptLongIcon fontSize="small" />, end: true },
  { to: '/clients', label: 'Clients', icon: <PeopleOutlineIcon fontSize="small" /> },
  { to: '/profile', label: 'Billing Profile', icon: <BusinessIcon fontSize="small" /> },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    navigate('/login');
  };

  const goTo = (to) => {
    setMenuAnchor(null);
    navigate(to);
  };

  return (
    <AppBar position="sticky" elevation={1} sx={{ backgroundColor: '#1E293B' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" component={RouterLink} to="/" sx={{ textDecoration: 'none', color: '#fff' }}>
            <ReceiptLongIcon sx={{ mr: 1.5, color: '#38BDF8', fontSize: 32 }} />
            <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: 0.5, display: { xs: 'none', sm: 'block' } }}>
              BillGen Pro
            </Typography>
          </Box>

          {user && (
            <>
              <Box display={{ xs: 'none', md: 'flex' }} alignItems="center" gap={1.5}>
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

                {NAV_LINKS.map((link) => (
                  <Button
                    key={link.to}
                    component={NavLink}
                    to={link.to}
                    end={link.end}
                    color="inherit"
                    startIcon={link.icon}
                    sx={{ textTransform: 'none', color: '#CBD5E1', '&.active': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' } }}
                  >
                    {link.label}
                  </Button>
                ))}

                <Box display="flex" alignItems="center" ml={1} gap={1}>
                  <UserAvatar user={user} />
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

              <Box display={{ xs: 'flex', md: 'none' }} alignItems="center" gap={0.5}>
                <Button
                  component={RouterLink}
                  to="/create"
                  variant="contained"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  sx={{ backgroundColor: '#38BDF8', color: '#0F172A', fontWeight: 600, textTransform: 'none', '&:hover': { backgroundColor: '#0284C7', color: '#fff' } }}
                >
                  New
                </Button>
                <IconButton color="inherit" aria-label="Open navigation menu" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                  <MenuIcon />
                </IconButton>
                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                  {NAV_LINKS.map((link) => (
                    <MenuItem key={link.to} onClick={() => goTo(link.to)}>
                      <ListItemIcon>{link.icon}</ListItemIcon>
                      <ListItemText>{link.label}</ListItemText>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Logout ({user.name || 'user'})</ListItemText>
                  </MenuItem>
                </Menu>
              </Box>
            </>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

function UserAvatar({ user }) {
  return user.picture ? (
    <Avatar src={user.picture} alt={user.name} sx={{ width: 34, height: 34 }} />
  ) : (
    <Avatar sx={{ width: 34, height: 34, bgcolor: '#38BDF8', color: '#0F172A', fontWeight: 600 }}>
      {user.name ? user.name[0] : 'U'}
    </Avatar>
  );
}
