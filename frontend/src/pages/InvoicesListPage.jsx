import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, IconButton,
  TextField, InputAdornment, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import { Link as RouterLink } from 'react-router-dom';
import api from '../api/client';

const getCurrencySymbol = (currency) => {
  if (currency === 'INR') return '₹';
  if (currency === 'EUR') return '€';
  if (currency === 'GBP') return '£';
  if (currency === 'CAD') return 'CA$';
  if (currency === 'AUD') return 'AU$';
  if (currency === 'AED') return 'AED ';
  return '$';
};

export default function InvoicesListPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // PDF Preview Dialog State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    fetchBills();
  }, [search]);

  const fetchBills = async () => {
    try {
      const res = await api.get('/bills', {
        params: { search: search || undefined },
      });
      setBills(res.data.bills || []);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill and its stored PDF?')) return;
    try {
      await api.delete('/bills', { params: { id: billId } });
      setBills(bills.filter((b) => b._id !== billId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete bill');
    }
  };

  const handleOpenPdf = async (billId, invoiceNumber) => {
    setPdfLoading(true);
    setPreviewOpen(true);
    setCurrentInvoiceNumber(invoiceNumber || 'invoice');
    try {
      const res = await api.get(`/bills/${billId}/pdf`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setCurrentPdfUrl(blobUrl);
    } catch (err) {
      let message = 'Failed to load PDF file from GridFS storage';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) message = parsed.message;
        } catch (_) {}
      }
      alert(message);
      setPreviewOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
      setCurrentPdfUrl(null);
    }
  };

  const handleDownloadCurrentPdf = () => {
    if (!currentPdfUrl) return;
    const a = document.createElement('a');
    a.href = currentPdfUrl;
    a.download = `${currentInvoiceNumber || 'invoice'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <div>
          <Typography variant="h5" fontWeight={700} color="#0F172A">
            Invoices & Bills
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your generated bills stored securely with GridFS PDF records.
          </Typography>
        </div>
        <Button
          component={RouterLink}
          to="/create"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ backgroundColor: '#0284C7', '&:hover': { backgroundColor: '#0369A1' } }}
        >
          Create New Bill
        </Button>
      </Box>

      {/* Search Bar */}
      <Box mb={3}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by invoice number, client or vendor name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 450 }}
        />
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Invoice #</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Billed To</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">PDF File</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No bills generated yet. Click "Create New Bill" to generate your first invoice!
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill._id} hover>
                  <TableCell sx={{ fontWeight: 600, color: '#0F172A' }}>
                    {bill.invoiceNumber}
                  </TableCell>
                  <TableCell>{bill.billDate}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {bill.billTo?.clientName || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {bill.billTo?.clientEmail}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#0F172A' }}>
                    {getCurrencySymbol(bill.currency)}{Number(bill.total || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    {bill.pdfFileId ? (
                      <Chip
                        icon={<PictureAsPdfIcon fontSize="small" />}
                        label="GridFS Stored"
                        size="small"
                        color="success"
                        variant="outlined"
                        onClick={() => handleOpenPdf(bill._id, bill.invoiceNumber)}
                        clickable
                      />
                    ) : (
                      <Chip label="Not Saved" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" justifyContent="center" gap={0.5}>
                      <IconButton
                        size="small"
                        color="primary"
                        title="View / Download PDF"
                        onClick={() => handleOpenPdf(bill._id, bill.invoiceNumber)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        title="Delete Bill"
                        onClick={() => handleDelete(bill._id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* PDF View Modal */}
      <Dialog open={previewOpen} onClose={handleClosePreview} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Invoice PDF - {currentInvoiceNumber}</span>
          {currentPdfUrl && (
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              size="small"
              onClick={handleDownloadCurrentPdf}
            >
              Download PDF
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 520, p: 0 }}>
          {pdfLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={500}>
              <CircularProgress />
            </Box>
          ) : currentPdfUrl ? (
            <iframe
              src={currentPdfUrl}
              title="Invoice PDF"
              width="100%"
              height="550px"
              style={{ border: 'none' }}
            />
          ) : (
            <Box p={3}>Unable to load PDF</Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
