import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Box, Button, TextField, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, DialogContentText, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import LockClockIcon from '@mui/icons-material/LockClock';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PageHeader from '../components/PageHeader';
import { Link as RouterLink } from 'react-router-dom';
import api from '../api/client';
import InvoiceList from '../components/InvoiceList';
import { errorMessage } from '../utils/format';

export default function InvoicesListPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState(null);

  const [lockOpen, setLockOpen] = useState(false);
  const [lockUpTo, setLockUpTo] = useState('');
  const [lockResult, setLockResult] = useState(null);

  const fetchBills = useCallback(async () => {
    try {
      const res = await api.get('/bills', { params: { search: search || undefined } });
      setBills(res.data.bills || []);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load invoices'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleLockPeriod = async () => {
    setLockResult(null);
    try {
      const res = await api.post('/bills/lock-period', { upTo: lockUpTo });
      setLockResult({ severity: 'success', message: res.data.message });
      fetchBills();
    } catch (err) {
      setLockResult({ severity: 'error', message: errorMessage(err, 'Failed to lock invoices') });
    }
  };

  const closeLockDialog = () => {
    setLockOpen(false);
    setLockResult(null);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      <PageHeader
        icon={<ReceiptLongIcon />}
        title="Invoices & Bills"
        subtitle="Edit, track payments and lock your invoices once they are final."
        actions={
          <>
            <Button variant="outlined" startIcon={<LockClockIcon />} onClick={() => setLockOpen(true)} sx={{ flex: { xs: 1, sm: 'none' } }}>
              Lock period
            </Button>
            <Button component={RouterLink} to="/create" variant="contained" startIcon={<AddIcon />} sx={{ flex: { xs: 1, sm: 'none' } }}>
              Create New Bill
            </Button>
          </>
        }
      />

      <Box mb={3}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by invoice number, client name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: { sm: 450 } }}
        />
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      <InvoiceList
        bills={bills}
        loading={loading}
        emptyText='No bills found. Click "Create New Bill" to generate your first invoice!'
        onBillUpdated={(updated) => setBills((prev) => prev.map((b) => (b._id === updated._id ? updated : b)))}
        onBillDeleted={(id) => setBills((prev) => prev.filter((b) => b._id !== id))}
      />

      <Dialog open={lockOpen} onClose={closeLockDialog} fullWidth maxWidth="xs">
        <DialogTitle>Lock invoices up to a date</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Locking freezes an invoice so its amounts, client and dates can no longer be changed or deleted by accident. Use this
            once a month or year is finalised and reported. Payments can still be recorded, and you can unlock a single invoice later if needed.
          </DialogContentText>
          {lockResult && <Alert severity={lockResult.severity} sx={{ mb: 2 }}>{lockResult.message}</Alert>}
          <TextField
            fullWidth
            type="date"
            label="Lock all invoices dated on or before"
            InputLabelProps={{ shrink: true }}
            value={lockUpTo}
            onChange={(e) => setLockUpTo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeLockDialog}>Close</Button>
          <Button variant="contained" onClick={handleLockPeriod} disabled={!lockUpTo}>Lock invoices</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
