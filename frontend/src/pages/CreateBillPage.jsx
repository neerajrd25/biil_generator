import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Grid, TextField, Button, Box,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Autocomplete, MenuItem, FormControlLabel, Switch, Card, CardContent, useMediaQuery
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LockIcon from '@mui/icons-material/Lock';
import api from '../api/client';
import { CURRENCIES, errorMessage } from '../utils/format';

export default function CreateBillPage() {
  const navigate = useNavigate();
  const { id: editingId } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(editingId);
  const fullScreenPreview = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // State
  const [readOnlyReason, setReadOnlyReason] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);

  const [currency, setCurrency] = useState('USD');

  const [billFrom, setBillFrom] = useState({
    vendorName: '',
    vendorEmail: '',
    vendorContact: '',
    vendorAddress: '',
    vendorCity: '',
    vendorState: '',
    vendorPin: '',
    vendorWebsite: '',
    vendorWebsite2: '',
    taxId: '',
  });

  const [billTo, setBillTo] = useState({
    clientName: '',
    clientEmail: '',
    clientContact: '',
    clientAddress: '',
    clientCity: '',
    clientState: '',
    clientPin: '',
  });

  const [invoiceMeta, setInvoiceMeta] = useState({
    invoiceNumber: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    taxRate: 0,
    notes: 'Payment is due within 15 days of invoice date.',
  });

  const [accountDetail, setAccountDetail] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifscCode: '',
  });

  const [lineItems, setLineItems] = useState([
    { id: 1, name: 'Professional Services', quantity: 1, price: 100 },
  ]);

  // Particulars / Bill Summary (Annexure on next page)
  const [includeParticulars, setIncludeParticulars] = useState(false);
  const [particulars, setParticulars] = useState([
    { srNo: 1, description: '', remarks: '' },
  ]);

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [profileRes, clientsRes, nextNumberRes, billRes] = await Promise.all([
        api.get('/billing-profile'),
        api.get('/clients'),
        isEditing
          ? Promise.resolve({ data: { nextInvoiceNumber: '' } })
          : api.get('/bills/next-number').catch(() => ({ data: { nextInvoiceNumber: '' } })),
        isEditing ? api.get(`/bills/${editingId}`) : Promise.resolve(null),
      ]);

      if (billRes) {
        loadExistingBill(billRes.data.bill);
      } else if (profileRes.data.profile) {
        const p = profileRes.data.profile;
        if (p.defaultCurrency) {
          setCurrency(p.defaultCurrency);
        }
        setBillFrom({
          vendorName: p.vendorName || '',
          vendorEmail: p.vendorEmail || '',
          vendorContact: p.vendorContact || '',
          vendorAddress: p.vendorAddress || '',
          vendorCity: p.vendorCity || '',
          vendorState: p.vendorState || '',
          vendorPin: p.vendorPin || '',
          vendorWebsite: p.vendorWebsite || '',
          vendorWebsite2: p.vendorWebsite2 || '',
          taxId: p.taxId || '',
        });
        if (p.accountDetail) {
          setAccountDetail(p.accountDetail);
        }
      }

      const savedClients = (clientsRes.data.clients || []).filter((c) => !c.isUnassigned);
      setClients(savedClients);

      const presetEmail = searchParams.get('client');
      if (!isEditing && presetEmail) {
        const preset = savedClients.find((c) => c.clientEmail === presetEmail.toLowerCase());
        if (preset) handleClientSelect(preset);
      }

      if (nextNumberRes.data.nextInvoiceNumber) {
        setInvoiceMeta(prev => ({ ...prev, invoiceNumber: nextNumberRes.data.nextInvoiceNumber }));
      }
    } catch (err) {
      console.warn('Initial data load error:', err);
      if (isEditing) setError(errorMessage(err, 'Failed to load the invoice for editing'));
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadExistingBill = (bill) => {
    if (bill.isLocked || bill.paymentStatus === 'VOID') {
      setReadOnlyReason(bill.paymentStatus === 'VOID' ? 'This invoice is void and cannot be edited.' : 'This invoice is locked. Unlock it from the invoices list to make changes.');
    }
    setCurrency(bill.currency || 'USD');
    setBillFrom((prev) => ({ ...prev, ...bill.billFrom }));
    setBillTo((prev) => ({ ...prev, ...bill.billTo }));
    setAccountDetail((prev) => ({ ...prev, ...bill.accountDetail }));
    setInvoiceMeta({
      invoiceNumber: bill.invoiceNumber || '',
      billDate: bill.billDate || '',
      dueDate: bill.dueDate || '',
      taxRate: bill.taxRate || 0,
      notes: bill.notes || '',
    });
    setLineItems(bill.lineItems.map((item, i) => ({ id: item.id || i + 1, name: item.name, quantity: item.quantity, price: item.price })));
    if (bill.particulars?.length) {
      setIncludeParticulars(true);
      setParticulars(bill.particulars.map((p, i) => ({ srNo: p.srNo || i + 1, description: p.description, remarks: p.remarks })));
    }
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
    if (client) {
      setBillTo({
        clientName: client.clientName || '',
        clientEmail: client.clientEmail || '',
        clientContact: client.clientContact || '',
        clientAddress: client.clientAddress || '',
        clientCity: client.clientCity || '',
        clientState: client.clientState || '',
        clientPin: client.clientPin || '',
      });
    }
  };

  const currentSymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';

  // Line items handlers
  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now(), name: '', quantity: 1, price: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Particulars handlers
  const handleParticularsChange = (index, field, value) => {
    const updated = [...particulars];
    updated[index][field] = value;
    setParticulars(updated);
  };

  const addParticularsRow = () => {
    setParticulars([...particulars, { srNo: particulars.length + 1, description: '', remarks: '' }]);
  };

  const removeParticularsRow = (index) => {
    if (particulars.length === 1) return;
    const filtered = particulars.filter((_, i) => i !== index);
    const renumbered = filtered.map((p, i) => ({ ...p, srNo: i + 1 }));
    setParticulars(renumbered);
  };

  // Live calculation
  const subtotal = lineItems.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.price) || 0;
    return acc + (q * p);
  }, 0);
  const taxAmount = (subtotal * (Number(invoiceMeta.taxRate) || 0)) / 100;
  const total = subtotal + taxAmount;

  const buildPayload = () => ({
    billFrom,
    billTo,
    lineItems,
    currency,
    taxRate: Number(invoiceMeta.taxRate) || 0,
    invoiceNumber: invoiceMeta.invoiceNumber || undefined,
    billDate: invoiceMeta.billDate,
    dueDate: invoiceMeta.dueDate,
    notes: invoiceMeta.notes,
    accountDetail,
    particulars: includeParticulars ? particulars : [],
  });

  const handlePreviewPdf = async () => {
    setError(null);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const payload = buildPayload();
      const response = await api.post('/bills/preview', payload, {
        responseType: 'blob',
      });
      const fileUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPreviewPdfUrl(fileUrl);
    } catch (err) {
      setError('Failed to generate PDF preview. Check details.');
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveBill = async () => {
    if (readOnlyReason) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billTo.clientEmail.trim())) {
      setPreviewOpen(false);
      setError('A valid client email is required - it identifies the client on their dashboard.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const res = isEditing ? await api.put(`/bills/${editingId}`, payload) : await api.post('/bills', payload);
      if (res.data.success) {
        navigate('/');
      }
    } catch (err) {
      setPreviewOpen(false);
      setError(errorMessage(err, 'Failed to save bill & PDF'));
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} flexDirection={{ xs: 'column', md: 'row' }} gap={2} mb={3}>
          <div>
            <Typography variant="h5" fontWeight={700}>
              {isEditing ? `Edit Invoice ${invoiceMeta.invoiceNumber}` : 'Create New Invoice'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEditing
                ? 'Update the details and save - the stored PDF is regenerated automatically.'
                : 'Fill in client and invoice details, preview the PDF, and store it directly in MongoDB.'}
            </Typography>
          </div>
          <Box display="flex" gap={1.5} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={handlePreviewPdf}
            >
              Preview PDF
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineIcon />}
              onClick={handleSaveBill}
              disabled={saving || Boolean(readOnlyReason)}
              
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Generate & Store Bill'}
            </Button>
          </Box>
        </Box>

        {readOnlyReason && (
          <Alert severity="warning" icon={<LockIcon fontSize="inherit" />} sx={{ mb: 3 }} action={<Button color="inherit" size="small" component={RouterLink} to="/">Back</Button>}>
            {readOnlyReason}
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Invoice Metadata and Currency Row */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Invoice Number"
              value={invoiceMeta.invoiceNumber}
              onChange={(e) => setInvoiceMeta({ ...invoiceMeta, invoiceNumber: e.target.value })}
              disabled={isEditing}
              helperText={isEditing ? 'Invoice numbers cannot change after creation' : 'Auto-sequenced from profile settings'}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="Currency (Per Bill)"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              helperText="Choose currency for this bill"
            >
              {CURRENCIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Invoice Date"
              InputLabelProps={{ shrink: true }}
              value={invoiceMeta.billDate}
              onChange={(e) => setInvoiceMeta({ ...invoiceMeta, billDate: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Due Date"
              InputLabelProps={{ shrink: true }}
              value={invoiceMeta.dueDate}
              onChange={(e) => setInvoiceMeta({ ...invoiceMeta, dueDate: e.target.value })}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Bill From and Bill To 2-Column Section */}
        <Grid container spacing={4} mb={3}>
          {/* Bill From (Sender) */}
          <Grid item xs={12} md={6}>
            <Box bgcolor="#F8FAFC" p={2.5} borderRadius={2} border="1px solid #E2E8F0">
              <Typography variant="subtitle1" fontWeight={700} color="#1E293B" mb={1.5}>
                Bill From (Your Business Profile)
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Business Name"
                    value={billFrom.vendorName}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Email"
                    value={billFrom.vendorEmail}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorEmail: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Phone"
                    value={billFrom.vendorContact}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorContact: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Address"
                    value={billFrom.vendorAddress}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorAddress: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="City"
                    value={billFrom.vendorCity}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorCity: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="State"
                    value={billFrom.vendorState}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorState: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Postal Code"
                    value={billFrom.vendorPin}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorPin: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Website"
                    value={billFrom.vendorWebsite}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorWebsite: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Second Website"
                    value={billFrom.vendorWebsite2}
                    onChange={(e) => setBillFrom({ ...billFrom, vendorWebsite2: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Bill To (Recipient) */}
          <Grid item xs={12} md={6}>
            <Box bgcolor="#F8FAFC" p={2.5} borderRadius={2} border="1px solid #E2E8F0">
              <Box display="flex" justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} flexDirection={{ xs: 'column', sm: 'row' }} gap={1} mb={1.5}>
                <Typography variant="subtitle1" fontWeight={700} color="#1E293B">
                  Bill To (Client / Recipient)
                </Typography>
                {clients.length > 0 && !isEditing && (
                  <Autocomplete
                    options={clients}
                    getOptionLabel={(option) => option.clientName || ''}
                    isOptionEqualToValue={(option, val) => option.key === val.key}
                    renderOption={(props, option) => (
                      <li {...props} key={option.key}>
                        <div>
                          <Typography variant="body2">{option.clientName}</Typography>
                          <Typography variant="caption" color="text.secondary">{option.clientEmail}</Typography>
                        </div>
                      </li>
                    )}
                    value={selectedClient}
                    onChange={(_, val) => handleClientSelect(val)}
                    renderInput={(params) => <TextField {...params} size="small" placeholder="Select Saved Client" />}
                    sx={{ width: { xs: '100%', sm: 200 } }}
                  />
                )}
              </Box>
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Client Name / Organization"
                    value={billTo.clientName}
                    onChange={(e) => setBillTo({ ...billTo, clientName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Client Email"
                    type="email"
                    required
                    helperText="Identifies the client"
                    value={billTo.clientEmail}
                    onChange={(e) => setBillTo({ ...billTo, clientEmail: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Client Contact"
                    value={billTo.clientContact}
                    onChange={(e) => setBillTo({ ...billTo, clientContact: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Client Address"
                    value={billTo.clientAddress}
                    onChange={(e) => setBillTo({ ...billTo, clientAddress: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="City"
                    value={billTo.clientCity}
                    onChange={(e) => setBillTo({ ...billTo, clientCity: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="State"
                    value={billTo.clientState}
                    onChange={(e) => setBillTo({ ...billTo, clientState: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Postal Code"
                    value={billTo.clientPin}
                    onChange={(e) => setBillTo({ ...billTo, clientPin: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Dynamic Line Items Table */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700} color="#1E293B">
            Line Items ({currency})
          </Typography>
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#F1F5F9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }} align="center">Quantity</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }} align="right">Rate ({currentSymbol})</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }} align="right">Amount ({currentSymbol})</TableCell>
                <TableCell sx={{ width: 60 }} align="center"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lineItems.map((item, index) => {
                const itemAmount = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                return (
                  <TableRow key={item.id || index}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Item or service description"
                        value={item.name}
                        onChange={(e) => handleLineItemChange(index, 'name', e.target.value)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                        inputProps={{ min: 1 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={item.price}
                        onChange={(e) => handleLineItemChange(index, 'price', e.target.value)}
                        inputProps={{ min: 0, step: 'any' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {currentSymbol}{itemAmount.toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length === 1}
                        color="error"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addLineItem} sx={{ mb: 3 }}>
          Add Item
        </Button>

        {/* Calculations and Totals Box */}
        <Grid container spacing={3} justifyContent="flex-end" mb={3}>
          <Grid item xs={12} sm={5} md={4}>
            <Box bgcolor="#F8FAFC" p={2} borderRadius={2} border="1px solid #E2E8F0">
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                <Typography variant="body2" fontWeight={600}>{currentSymbol}{subtotal.toFixed(2)}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">Tax (%):</Typography>
                <TextField
                  size="small"
                  type="number"
                  value={invoiceMeta.taxRate}
                  onChange={(e) => setInvoiceMeta({ ...invoiceMeta, taxRate: e.target.value })}
                  sx={{ width: 80 }}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Box>
              {taxAmount > 0 && (
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">Tax Amount:</Typography>
                  <Typography variant="body2">{currentSymbol}{taxAmount.toFixed(2)}</Typography>
                </Box>
              )}
              <Divider sx={{ my: 1.5 }} />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="h6" fontWeight={700} color="#0F172A">Total:</Typography>
                <Typography variant="h6" fontWeight={700} color="#4F46E5">{currentSymbol}{total.toFixed(2)}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Notes & Terms */}
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Notes / Terms & Conditions"
          value={invoiceMeta.notes}
          onChange={(e) => setInvoiceMeta({ ...invoiceMeta, notes: e.target.value })}
          sx={{ mb: 4 }}
        />

        <Divider sx={{ my: 3 }} />

        {/* Optional Particulars / Bill Summary (Always Next Page) */}
        <Card variant="outlined" sx={{ bgcolor: '#F8FAFC', borderColor: includeParticulars ? '#818CF8' : '#E2E8F0' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <PostAddIcon sx={{ color: '#4F46E5' }} />
                <div>
                  <Typography variant="subtitle1" fontWeight={700} color="#1E293B">
                    Particulars / Bill Summary (Optional - Page 2 Annexure)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Itemized list of particulars, scope of work, deliverables, and remarks printed automatically on the next page of your PDF.
                  </Typography>
                </div>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeParticulars}
                    onChange={(e) => setIncludeParticulars(e.target.checked)}
                    color="primary"
                  />
                }
                label={includeParticulars ? 'Included on Page 2' : 'Disabled'}
              />
            </Box>

            {includeParticulars && (
              <Box mt={3}>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#F1F5F9' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">Sr No</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Particulars / Description</TableCell>
                        <TableCell sx={{ fontWeight: 600, width: 220 }}>Remarks / Details</TableCell>
                        <TableCell sx={{ width: 60 }} align="center"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {particulars.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight={600}>{row.srNo}</Typography>
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="e.g. Scope of work, milestone delivered, task details..."
                              value={row.description}
                              onChange={(e) => handleParticularsChange(index, 'description', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="e.g. Completed, Phase 1"
                              value={row.remarks}
                              onChange={(e) => handleParticularsChange(index, 'remarks', e.target.value)}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeParticularsRow(index)}
                              disabled={particulars.length === 1}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  size="small"
                  onClick={addParticularsRow}
                >
                  Add Particulars Row
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Paper>

      {/* PDF Live Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth fullScreen={fullScreenPreview}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Invoice Preview ({currency})</span>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveBill}
            disabled={saving || Boolean(readOnlyReason)}
            
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Invoice'}
          </Button>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 480, p: 0 }}>
          {previewLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={480}>
              <CircularProgress />
            </Box>
          ) : previewPdfUrl ? (
            <iframe
              src={previewPdfUrl}
              title="PDF Preview"
              width="100%"
              height="550px"
              style={{ border: 'none' }}
            />
          ) : (
            <Box p={3}>Unable to load preview</Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
