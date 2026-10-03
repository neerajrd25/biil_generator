import React from 'react';
import { Box, Typography } from '@mui/material';
import { brandGradient } from '../theme';

export default function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      flexDirection={{ xs: 'column', sm: 'row' }}
      gap={2}
      mb={3}
    >
      <Box display="flex" alignItems="center" gap={2} minWidth={0}>
        {icon && (
          <Box
            sx={{
              width: 52, height: 52, borderRadius: 3, flexShrink: 0, display: 'grid', placeItems: 'center',
              color: '#fff', background: brandGradient, boxShadow: '0 10px 24px rgba(79,70,229,0.35)',
              '& svg': { fontSize: 28 },
            }}
          >
            {icon}
          </Box>
        )}
        <Box minWidth={0}>
          <Typography variant="h5" sx={{ wordBreak: 'break-word' }}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Box>
      {actions && <Box display="flex" gap={1} flexWrap="wrap">{actions}</Box>}
    </Box>
  );
}
