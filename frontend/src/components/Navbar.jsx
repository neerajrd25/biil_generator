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
import { brandGradient, darkGradient } from '../theme';

const ctaSx = {
  color: '#fff',
  fontWeight: 700,
  backgroundImage: 'linear-gradient(135deg, #EC4899 0%, #F97316 100%)',
  boxShadow: '0 6px 18px rgba(236,72,153,0.45)',
  '&:hover': { backgroundImage: 'linear-gradient(135deg, #DB2777 0%, #EA580C 100%)' },
};

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
    navigate('/login', { replace: true });
  };

  const goTo = (to) => {
    setMenuAnchor(null);
    navigate(to);
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ background: darkGradient, borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 30px rgba(15,23,42,0.25)' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" component={RouterLink} to="/" sx={{ textDecoration: 'none', color: '#fff' }}>
            <Box sx={{ mr: 1.5, width: 38, height: 38, borderRadius: 2.5, display: 'grid', placeItems: 'center', background: brandGradient, boxShadow: '0 6px 18px rgba(124,58,237,0.5)' }}>
              <ReceiptLongIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 0.3, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              BillGen
              <Box component="span" sx={{ fontSize: 11, fontWeight: 800, px: 1, py: 0.25, borderRadius: 1.5, background: brandGradient, letterSpacing: 0.8 }}>PRO</Box>
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
                  sx={ctaSx}
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
                    sx={{ color: '#CBD5E1', borderRadius: 999, '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' }, '&.active': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.14)' } }}
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
                  sx={ctaSx}
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
    <Avatar sx={{ width: 34, height: 34, background: brandGradient, color: '#fff', fontWeight: 600 }}>
      {user.name ? user.name[0] : 'U'}
    </Avatar>
  );
}
