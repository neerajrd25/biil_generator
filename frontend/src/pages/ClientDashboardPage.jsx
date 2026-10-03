import React, { useCallback, useEffect, useState } from 'react';
import { Container, Typography, Box, Button, Grid, Paper, Alert, CircularProgress, Chip, Divider, Avatar } from '@mui/material';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { brandGradient } from '../theme';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink, useParams } from 'react-router-dom';
import api from '../api/client';
import InvoiceList from '../components/InvoiceList';
import StatCard from '../components/StatCard';
import { STATUS_META, errorMessage, formatMoney } from '../utils/format';

const AGING_BUCKETS = [
  { key: 'current', label: 'Not yet due', color: '#818CF8' },
  { key: 'days1to30', label: '1-30 days late', color: '#F59E0B' },
  { key: 'days31to60', label: '31-60 days late', color: '#F97316' },
  { key: 'days60plus', label: '60+ days late', color: '#DC2626' },
];

function AgingBar({ aging, currency }) {
  const total = AGING_BUCKETS.reduce((sum, b) => sum + aging[b.key], 0);
  if (total <= 0) {
    return <Typography variant="body2" color="text.secondary">Nothing outstanding.</Typography>;
  }
  return (
    <>
      <Box display="flex" height={14} borderRadius={7} overflow="hidden" bgcolor="#E2E8F0">
        {AGING_BUCKETS.filter((b) => aging[b.key] > 0).map((b) => (
          <Box key={b.key} sx={{ width: `${(aging[b.key] / total) * 100}%`, bgcolor: b.color }} />
        ))}
      </Box>
      <Box display="flex" flexWrap="wrap" columnGap={2.5} rowGap={0.5} mt={1.5}>
        {AGING_BUCKETS.map((b) => (
          <Box key={b.key} display="flex" alignItems="center" gap={0.75}>
            <Box width={10} height={10} borderRadius="50%" bgcolor={b.color} />
            <Typography variant="caption">{b.label}: <b>{formatMoney(aging[b.key], currency)}</b></Typography>
          </Box>
        ))}
      </Box>
    </>
  );
}

function MonthlyChart({ months, currency }) {
  const max = Math.max(...months.map((m) => m.billed), 1);
  const label = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString(undefined, { month: 'short', timeZone: 'UTC' });
  return (
    <>
      <Box display="flex" alignItems="flex-end" gap={{ xs: 0.5, sm: 1 }} height={140}>
        {months.map((m) => (
          <Box key={m.month} flex={1} minWidth={0} height="100%" display="flex" alignItems="flex-end" justifyContent="center" gap="2px"
            title={`${m.month}: billed ${formatMoney(m.billed, currency)}, collected ${formatMoney(m.paid, currency)}`}>
            <Box sx={{ width: '45%', height: `${(m.billed / max) * 100}%`, minHeight: m.billed > 0 ? 2 : 0, bgcolor: '#6366F1', borderRadius: '3px 3px 0 0' }} />
            <Box sx={{ width: '45%', height: `${(m.paid / max) * 100}%`, minHeight: m.paid > 0 ? 2 : 0, bgcolor: '#10B981', borderRadius: '3px 3px 0 0' }} />
          </Box>
        ))}
      </Box>
      <Box display="flex" gap={{ xs: 0.5, sm: 1 }} mt={0.5}>
        {months.map((m) => (
          <Typography key={m.month} variant="caption" color="text.secondary" align="center" sx={{ flex: 1, minWidth: 0, fontSize: { xs: 9, sm: 12 } }}>
            {label(m.month)}
          </Typography>
        ))}
      </Box>
      <Box display="flex" gap={2} mt={1}>
        <Box display="flex" alignItems="center" gap={0.75}><Box width={10} height={10} bgcolor="#6366F1" /><Typography variant="caption">Billed</Typography></Box>
        <Box display="flex" alignItems="center" gap={0.75}><Box width={10} height={10} bgcolor="#10B981" /><Typography variant="caption">Collected</Typography></Box>
      </Box>
    </>
  );
}

export default function ClientDashboardPage() {
  const { email } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/clients/dashboard', { params: { email } });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load client'));
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const back = (
    <Button component={RouterLink} to="/clients" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>All clients</Button>
  );

  if (loading) {
    return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  }

  if (error || !data) {
    return <Container maxWidth="lg" sx={{ py: 4 }}>{back}<Alert severity="error">{error || 'Client not found'}</Alert></Container>;
  }

  const { client, totalsByCurrency, monthlyByCurrency, statusCounts, invoices } = data;
  const currencies = Object.entries(totalsByCurrency);
  const address = [client.clientAddress, client.clientCity, client.clientState, client.clientPin].filter(Boolean).join(', ');

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      {back}

      <Box
        sx={{
          position: 'relative', overflow: 'hidden', color: '#fff', borderRadius: 4, p: { xs: 2.5, sm: 4 }, mb: 3,
          background: brandGradient, boxShadow: '0 20px 50px rgba(79,70,229,0.35)',
          '&::after': { content: '""', position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' },
          '&::before': { content: '""', position: 'absolute', right: 90, bottom: -90, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' },
        }}
      >
        <Box position="relative" zIndex={1} display="flex" justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
          <Box display="flex" alignItems="center" gap={2} minWidth={0}>
            <Avatar sx={{ width: 64, height: 64, fontSize: 28, fontWeight: 800, bgcolor: 'rgba(255,255,255,0.22)', border: '2px solid rgba(255,255,255,0.5)' }}>
              {(client.clientName || '?')[0].toUpperCase()}
            </Avatar>
            <Box minWidth={0}>
              <Typography variant="h5" sx={{ wordBreak: 'break-word' }}>{client.clientName}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, wordBreak: 'break-all' }}>
                {client.isUnassigned ? 'Invoices without a client email' : client.clientEmail}
              </Typography>
              {client.clientContact && <Typography variant="body2" sx={{ opacity: 0.85 }}>{client.clientContact}</Typography>}
              {address && <Typography variant="body2" sx={{ opacity: 0.85 }}>{address}</Typography>}
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            {currencies.map(([currency, t]) => (
              <Box key={currency} sx={{ bgcolor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', borderRadius: 3, px: 2, py: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.6 }}>Outstanding</Typography>
                <Typography variant="h6" fontWeight={800}>{formatMoney(t.outstanding, currency)}</Typography>
              </Box>
            ))}
            {!client.isUnassigned && (
              <Button
                component={RouterLink}
                to={`/create?client=${encodeURIComponent(client.clientEmail)}`}
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ backgroundImage: 'none', bgcolor: '#fff', color: 'primary.main', boxShadow: '0 8px 20px rgba(0,0,0,0.2)', '&:hover': { backgroundImage: 'none', bgcolor: '#F1F5F9' } }}
              >
                New invoice
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {client.isUnassigned && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          These invoices were created before client emails were required. Edit each one and add the client email to move it to the right client.
        </Alert>
      )}

      <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
        {Object.keys(STATUS_META).map((status) => (
          <Chip key={status} label={`${STATUS_META[status].label}: ${statusCounts[status] || 0}`} color={statusCounts[status] ? STATUS_META[status].color : 'default'} variant={statusCounts[status] && STATUS_META[status].color !== 'default' ? 'filled' : 'outlined'} size="small" />
        ))}
      </Box>

      {currencies.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>No invoices for this client yet.</Alert>
      )}

      {currencies.map(([currency, t]) => (
        <Box key={currency} mb={4}>
          {currencies.length > 1 && <Typography variant="subtitle1" fontWeight={700} mb={1}>{currency}</Typography>}
          <Grid container spacing={2} mb={2}>
            <Grid item xs={6} md={3}><StatCard icon={<RequestQuoteOutlinedIcon />} label="Total billed" value={formatMoney(t.billed, currency)} hint={`${t.invoiceCount} invoice${t.invoiceCount === 1 ? '' : 's'}`} /></Grid>
            <Grid item xs={6} md={3}><StatCard icon={<SavingsOutlinedIcon />} accent="#10B981" label="Collected" value={formatMoney(t.paid, currency)} color="#15803D" /></Grid>
            <Grid item xs={6} md={3}><StatCard icon={<HourglassBottomIcon />} accent="#F59E0B" label="Outstanding" value={formatMoney(t.outstanding, currency)} /></Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<WarningAmberIcon />} accent="#EF4444" label="Overdue" value={formatMoney(t.overdue, currency)} color={t.overdue > 0 ? '#B91C1C' : '#0F172A'} hint={t.overdueCount ? `${t.overdueCount} invoice${t.overdueCount === 1 ? '' : 's'}` : undefined} />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2.5, height: '100%', bgcolor: 'rgba(255,255,255,0.9)' }}>
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Outstanding by age</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>How long unpaid balances have been past their due date.</Typography>
                <AgingBar aging={t.aging} currency={currency} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2.5, height: '100%', bgcolor: 'rgba(255,255,255,0.9)' }}>
                <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Last 12 months</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>By invoice date: amount billed and how much of it has been collected.</Typography>
                {monthlyByCurrency[currency] ? <MonthlyChart months={monthlyByCurrency[currency]} currency={currency} /> : (
                  <Typography variant="body2" color="text.secondary">No invoices in the last 12 months.</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      ))}

      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" fontWeight={700} mb={2}>Invoices</Typography>
      <InvoiceList
        bills={invoices}
        loading={false}
        showClient={false}
        emptyText="No invoices yet."
        onBillUpdated={load}
        onBillDeleted={load}
      />
    </Container>
  );
}
