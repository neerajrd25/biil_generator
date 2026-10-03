import React from 'react';
import { Paper, Typography } from '@mui/material';

export default function StatCard({ label, value, color = '#0F172A', hint }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} color={color} sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}
