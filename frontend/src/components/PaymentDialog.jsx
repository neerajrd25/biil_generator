import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Alert, Box,
} from '@mui/material';
import api from '../api/client';
import { errorMessage, formatMoney } from '../utils/format';

export default function PaymentDialog({ bill, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (bill) {
      setAmount(String(bill.amountPaid ?? 0));
      setError(null);
    }
  }, [bill]);

  if (!bill) return null;

  const save = async (value) => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/bills/${bill._id}`, { action: 'payment', amountPaid: Number(value) });
      onSaved(res.data.bill);
    } catch (err) {
      setError(errorMessage(err, 'Failed to record payment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Record payment - {bill.invoiceNumber}</DialogTitle>
      <DialogContent>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="body2" color="text.secondary">Invoice total</Typography>
          <Typography variant="body2" fontWeight={700}>{formatMoney(bill.total, bill.currency)}</Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          fullWidth
          type="number"
          label="Total amount received so far"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helperText="Enter the combined amount the client has paid for this invoice, not just the latest installment."
          inputProps={{ min: 0, max: bill.total, step: 'any' }}
        />
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => save(bill.total)} disabled={saving} color="success">Mark fully paid</Button>
        <Button onClick={() => save(amount)} disabled={saving || amount === ''} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
