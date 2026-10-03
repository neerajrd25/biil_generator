import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Grid, TextField, Button, Box, Alert, Snackbar,
  Divider, CircularProgress, MenuItem, Card, CardContent
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import BusinessIcon from '@mui/icons-material/Business';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TagIcon from '@mui/icons-material/Tag';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import api from '../api/client';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($ - USD)', symbol: '$' },
  { code: 'INR', label: 'Indian Rupee (₹ - INR)', symbol: '₹' },
  { code: 'EUR', label: 'Euro (€ - EUR)', symbol: '€' },
  { code: 'GBP', label: 'British Pound (£ - GBP)', symbol: '£' },
  { code: 'CAD', label: 'Canadian Dollar (CA$ - CAD)', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar (AU$ - AUD)', symbol: 'AU$' },
  { code: 'AED', label: 'UAE Dirham (AED)', symbol: 'AED' },
];

export default function BillingProfilePage() {
  const [profile, setProfile] = useState({
    vendorName: '',
    vendorEmail: '',
    vendorContact: '',
    vendorAddress: '',
    vendorCity: '',
    vendorState: '',
    vendorPin: '',
    taxId: '',
    defaultCurrency: 'USD',
    invoiceSettings: {
      prefix: 'NV',
      format: 'DATE_BASED',
      separator: '',
      digits: 3,
      nextSequence: 1,
    },
    accountDetail: {
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      ifscCode: '',
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/billing-profile');
      if (res.data.profile) {
        setProfile((prev) => ({
          ...prev,
          ...res.data.profile,
          defaultCurrency: res.data.profile.defaultCurrency || 'USD',
          invoiceSettings: {
            ...prev.invoiceSettings,
            ...(res.data.profile.invoiceSettings || {}),
          },
          accountDetail: {
            ...prev.accountDetail,
            ...(res.data.profile.accountDetail || {}),
          },
        }));
      }
    } catch (err) {
      setToast({ open: true, message: 'Failed to load billing profile', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('account.')) {
      const field = name.split('.')[1];
      setProfile((prev) => ({
        ...prev,
        accountDetail: {
          ...prev.accountDetail,
          [field]: value,
        },
      }));
    } else if (name.startsWith('invoiceSettings.')) {
      const field = name.split('.')[1];
      setProfile((prev) => ({
        ...prev,
        invoiceSettings: {
          ...prev.invoiceSettings,
          [field]: value,
        },
      }));
    } else {
      setProfile((prev) => ({ ...prev, [name]: value }));
    }
  };

  const getSampleInvoiceNumber = () => {
    const s = profile.invoiceSettings;
    const prefix = (s.prefix || 'NV').trim();
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const seq = String(s.nextSequence || 1).padStart(Number(s.digits) || 3, '0');
    const sep = s.separator || '';

    if (s.format === 'DATE_BASED') {
      return sep ? `${prefix}${sep}${yyyy}${mm}${dd}${sep}${seq}` : `${prefix}${yyyy}${mm}${dd}${seq}`;
    }
    if (s.format === 'YEAR_SEQUENTIAL') {
      return sep ? `${prefix}${sep}${yyyy}${sep}${seq}` : `${prefix}${yyyy}${seq}`;
    }
    return sep ? `${prefix}${sep}${seq}` : `${prefix}${seq}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/billing-profile', profile);
      setToast({ open: true, message: 'Billing profile & invoice settings updated successfully!', severity: 'success' });
    } catch (err) {
      setToast({ open: true, message: err.response?.data?.message || 'Failed to save profile', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" gap={1.5} mb={3}>
          <BusinessIcon sx={{ color: '#0284C7', fontSize: 32 }} />
          <div>
            <Typography variant="h5" fontWeight={700}>
              Billing Profile (Bill From)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure your business details, default currency, and automatic invoice number sequence.
            </Typography>
          </div>
        </Box>

        <form onSubmit={handleSubmit}>
          {/* Business Details */}
          <Typography variant="subtitle1" fontWeight={600} color="#0F172A" gutterBottom>
            Business Details
          </Typography>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Business / Vendor Name"
                name="vendorName"
                value={profile.vendorName}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="vendorEmail"
                type="email"
                value={profile.vendorEmail}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone / Contact"
                name="vendorContact"
                value={profile.vendorContact}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tax / GST ID"
                name="taxId"
                value={profile.taxId}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                name="vendorAddress"
                value={profile.vendorAddress}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="City"
                name="vendorCity"
                value={profile.vendorCity}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="State"
                name="vendorState"
                value={profile.vendorState}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Postal / PIN Code"
                name="vendorPin"
                value={profile.vendorPin}
                onChange={handleChange}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Currency Configuration */}
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <CurrencyExchangeIcon sx={{ color: '#0284C7' }} />
            <Typography variant="subtitle1" fontWeight={600} color="#0F172A">
              Default Currency Setup
            </Typography>
          </Box>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Default Billing Currency"
                name="defaultCurrency"
                value={profile.defaultCurrency}
                onChange={handleChange}
                helperText="Can still be customized on each individual bill"
              >
                {CURRENCIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Invoice Number Generation Settings */}
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <TagIcon sx={{ color: '#0284C7' }} />
            <div>
              <Typography variant="subtitle1" fontWeight={600} color="#0F172A">
                Invoice Number Configuration
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Configure how invoice numbers are generated and incremented automatically.
              </Typography>
            </div>
          </Box>

          <Card variant="outlined" sx={{ mb: 3, bgcolor: '#F8FAFC' }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Prefix"
                    name="invoiceSettings.prefix"
                    value={profile.invoiceSettings.prefix}
                    onChange={handleChange}
                    placeholder="e.g. NV or INV"
                    helperText="Letters at start of number"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    fullWidth
                    label="Numbering Format"
                    name="invoiceSettings.format"
                    value={profile.invoiceSettings.format}
                    onChange={handleChange}
                  >
                    <MenuItem value="DATE_BASED">Date-based (e.g. NV20261002001)</MenuItem>
                    <MenuItem value="SEQUENTIAL">Simple Sequential (e.g. NV001)</MenuItem>
                    <MenuItem value="YEAR_SEQUENTIAL">Year Sequential (e.g. NV-2026-001)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    fullWidth
                    label="Separator"
                    name="invoiceSettings.separator"
                    value={profile.invoiceSettings.separator}
                    onChange={handleChange}
                  >
                    <MenuItem value="">None (e.g. NV20261002001 / NV001)</MenuItem>
                    <MenuItem value="-">Hyphen "-" (e.g. NV-20261002-001 / NV-001)</MenuItem>
                    <MenuItem value="/">Slash "/" (e.g. NV/20261002/001)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    label="Sequence Padding Digits"
                    name="invoiceSettings.digits"
                    value={profile.invoiceSettings.digits}
                    onChange={handleChange}
                    inputProps={{ min: 1, max: 6 }}
                    helperText="3 = 001, 4 = 0001"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="number"
                    fullWidth
                    label="Next Sequence Number"
                    name="invoiceSettings.nextSequence"
                    value={profile.invoiceSettings.nextSequence}
                    onChange={handleChange}
                    inputProps={{ min: 1 }}
                    helperText="Increments programmatically with each generated bill"
                  />
                </Grid>
              </Grid>

              <Box mt={2} p={1.5} bgcolor="#EFF6FF" borderRadius={1} border="1px dashed #93C5FD">
                <Typography variant="body2" color="#1E40AF">
                  <strong>Preview of Next Invoice #:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem' }}>
                    {getSampleInvoiceNumber()}
                  </span>
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Divider sx={{ my: 3 }} />

          {/* Bank Information */}
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <AccountBalanceIcon sx={{ color: '#0284C7' }} />
            <Typography variant="subtitle1" fontWeight={600} color="#0F172A">
              Bank & Payment Information (Optional)
            </Typography>
          </Box>
          <Grid container spacing={2} mb={4}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bank Name"
                name="account.bankName"
                value={profile.accountDetail.bankName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Account Holder Name"
                name="account.accountHolder"
                value={profile.accountDetail.accountHolder}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Account Number / IBAN"
                name="account.accountNumber"
                value={profile.accountDetail.accountNumber}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="IFSC / Swift / Routing Code"
                name="account.ifscCode"
                value={profile.accountDetail.ifscCode}
                onChange={handleChange}
              />
            </Grid>
          </Grid>

          <Box display="flex" justifyContent="flex-end">
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              sx={{ backgroundColor: '#0284C7', '&:hover': { backgroundColor: '#0369A1' } }}
            >
              {saving ? 'Saving...' : 'Save Profile & Settings'}
            </Button>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
