import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export default function StatCard({ label, value, color = '#0F172A', hint, icon, accent = '#4F46E5' }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2, height: '100%', position: 'relative', overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.9)',
        transition: 'transform .2s ease, box-shadow .2s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 30px rgba(79,70,229,0.14)' },
        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={800} color={color} sx={{ wordBreak: 'break-word', fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
            {value}
          </Typography>
          {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
        </Box>
        {icon && (
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: 'grid', placeItems: 'center', color: accent, bgcolor: `${accent}1A`, '& svg': { fontSize: 22 } }}>
            {icon}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
