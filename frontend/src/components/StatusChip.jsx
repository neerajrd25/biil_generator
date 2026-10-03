import React from 'react';
import { Chip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { STATUS_META, getDisplayStatus } from '../utils/format';

export function PaymentStatusChip({ bill }) {
  const meta = STATUS_META[getDisplayStatus(bill)];
  return <Chip size="small" label={meta.label} color={meta.color} variant={meta.color === 'default' ? 'outlined' : 'filled'} />;
}

export function LockedChip() {
  return <Chip size="small" icon={<LockIcon />} label="Locked" variant="outlined" sx={{ color: '#475569' }} />;
}
