import React, { useEffect, useMemo, useState } from 'react';
import {
  Container, Typography, Box, TextField, InputAdornment, Grid, Paper, CircularProgress, Alert,
  Card, CardActionArea, CardContent, Chip, Button, Avatar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import PageHeader from '../components/PageHeader';
import { brandGradient } from '../theme';
import { Link as RouterLink } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';
import { clientPath, errorMessage, formatMoney } from '../utils/format';

function ClientCard({ client }) {
  const currencies = Object.entries(client.totalsByCurrency);
  return (
    <Card variant="outlined" sx={{ height: '100%', bgcolor: 'rgba(255,255,255,0.9)', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 34px rgba(79,70,229,0.16)' } }}>
      <CardActionArea component={RouterLink} to={clientPath(client)} sx={{ height: '100%', alignItems: 'flex-start' }}>
        <CardContent>
          <Box display="flex" alignItems="flex-start" gap={1.5}>
            <Avatar sx={{ background: brandGradient, fontWeight: 700 }}>{(client.clientName || '?')[0].toUpperCase()}</Avatar>
            <Box minWidth={0} flexGrow={1}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>{client.clientName}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {client.isUnassigned ? 'Invoices without a client email' : client.clientEmail}
              </Typography>
            </Box>
            <Chip size="small" label={`${client.invoiceCount} invoice${client.invoiceCount === 1 ? '' : 's'}`} />
          </Box>

          {currencies.length === 0 ? (
            <Typography variant="body2" color="text.secondary" mt={2}>No invoices yet</Typography>
          ) : (
            currencies.map(([currency, t]) => (
              <Box key={currency} display="flex" justifyContent="space-between" gap={1} mt={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Billed</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatMoney(t.billed, currency)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Paid</Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">{formatMoney(t.paid, currency)}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary" display="block">Outstanding</Typography>
                  <Typography variant="body2" fontWeight={700} color={t.overdue > 0 ? 'error.main' : 'text.primary'}>
                    {formatMoney(t.outstanding, currency)}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
          {client.lastInvoiceDate && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
              Last invoice {client.lastInvoiceDate}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function ClientsPage() {
  const [data, setData] = useState({ clients: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/clients')
      .then((res) => setData({ clients: res.data.clients || [], summary: res.data.summary }))
      .catch((err) => setError(errorMessage(err, 'Failed to load clients')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.clients;
    return data.clients.filter((c) => `${c.clientName} ${c.clientEmail}`.toLowerCase().includes(q));
  }, [data.clients, search]);

  const unassigned = data.clients.find((c) => c.isUnassigned);
  const totals = Object.entries(data.summary?.totalsByCurrency || {});

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      <PageHeader
        icon={<PeopleOutlineIcon />}
        title="Clients"
        subtitle={`${data.summary ? `${data.summary.clientCount} client${data.summary.clientCount === 1 ? '' : 's'} · ` : ''}identified by email. Open one to see their financial dashboard.`}
        actions={<Button component={RouterLink} to="/create" variant="contained" startIcon={<AddIcon />}>Create New Bill</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
        <>
          {totals.map(([currency, t]) => (
            <Grid container spacing={2} key={currency} mb={2}>
              <Grid item xs={6} md={4}><StatCard icon={<RequestQuoteOutlinedIcon />} label={`Billed (${currency})`} value={formatMoney(t.billed, currency)} /></Grid>
              <Grid item xs={6} md={4}><StatCard label={`Collected (${currency})`} value={formatMoney(t.paid, currency)} color="#15803D" accent="#10B981" icon={<SavingsOutlinedIcon />} /></Grid>
              <Grid item xs={12} md={4}>
                <StatCard
                  icon={<HourglassBottomIcon />}
                  accent={t.overdue > 0 ? '#EF4444' : '#F59E0B'}
                  label={`Outstanding (${currency})`}
                  value={formatMoney(t.outstanding, currency)}
                  color={t.overdue > 0 ? '#B91C1C' : '#0F172A'}
                  hint={t.overdue > 0 ? `${formatMoney(t.overdue, currency)} overdue` : undefined}
                />
              </Grid>
            </Grid>
          ))}

          {unassigned && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {unassigned.invoiceCount} invoice(s) have no client email, so they cannot be attached to a client.{' '}
              <RouterLink to={clientPath(unassigned)}>Review them</RouterLink> and add an email by editing each invoice.
            </Alert>
          )}

          <TextField
            fullWidth
            size="small"
            placeholder="Search clients by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
            sx={{ maxWidth: { sm: 450 }, my: 2 }}
          />

          {filtered.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              {data.clients.length === 0
                ? 'No clients yet. Clients appear automatically when you create an invoice with a client email.'
                : 'No clients match your search.'}
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {filtered.map((client) => (
                <Grid item xs={12} sm={6} md={4} key={client.key}>
                  <ClientCard client={client} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Container>
  );
}
