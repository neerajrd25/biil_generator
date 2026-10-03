import { createTheme, alpha } from '@mui/material/styles';

export const BRAND = '#4F46E5';
export const brandGradient = 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #EC4899 100%)';
export const softGradient = 'linear-gradient(135deg, rgba(79,70,229,0.10) 0%, rgba(236,72,153,0.08) 100%)';
export const darkGradient = 'linear-gradient(90deg, #0F172A 0%, #1E1B4B 55%, #312E81 100%)';

const theme = createTheme({
  palette: {
    primary: { main: BRAND, light: '#818CF8', dark: '#3730A3' },
    secondary: { main: '#EC4899' },
    success: { main: '#10B981' },
    error: { main: '#EF4444' },
    warning: { main: '#F59E0B' },
    info: { main: '#0EA5E9' },
    text: { primary: '#0F172A', secondary: '#64748B' },
    background: { default: '#F5F6FF', paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 800, letterSpacing: -0.5 },
    h5: { fontWeight: 800, letterSpacing: -0.3 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F5F6FF',
          backgroundImage:
            'radial-gradient(at 0% 0%, rgba(99,102,241,0.14) 0px, transparent 45%), radial-gradient(at 100% 0%, rgba(236,72,153,0.10) 0px, transparent 40%), radial-gradient(at 50% 100%, rgba(14,165,233,0.08) 0px, transparent 45%)',
          backgroundAttachment: 'fixed',
        },
        '@keyframes fadeUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'none' },
        },
        '.fade-in': { animation: 'fadeUp 0.45s ease both' },
        '@media (prefers-reduced-motion: reduce)': { '.fade-in': { animation: 'none' } },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, paddingInline: 18, transition: 'transform .15s ease, box-shadow .15s ease' },
        containedPrimary: {
          backgroundImage: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          boxShadow: '0 6px 16px rgba(79,70,229,0.35)',
          '&:hover': { backgroundImage: 'linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)', transform: 'translateY(-1px)', boxShadow: '0 10px 22px rgba(79,70,229,0.4)' },
          '&.Mui-disabled': { backgroundImage: 'none', boxShadow: 'none' },
        },
        outlinedPrimary: { borderColor: alpha(BRAND, 0.4), '&:hover': { backgroundColor: alpha(BRAND, 0.06), borderColor: BRAND } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
        elevation1: { boxShadow: '0 4px 20px rgba(15,23,42,0.06)' },
        elevation2: { boxShadow: '0 8px 30px rgba(79,70,229,0.08)' },
        elevation3: { boxShadow: '0 12px 40px rgba(79,70,229,0.14)' },
        outlined: { borderColor: 'rgba(99,102,241,0.15)' },
      },
    },
    MuiCard: { styleOverrides: { root: { borderRadius: 16 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.8)',
          '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(BRAND, 0.12)}` },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475569', fontWeight: 700 },
      },
    },
    MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: alpha(BRAND, 0.04) } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

export default theme;
