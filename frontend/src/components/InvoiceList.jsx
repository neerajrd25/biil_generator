import React, { useState } from 'react';
import {
  Paper, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Menu, MenuItem, ListItemIcon, ListItemText, Tooltip, useMediaQuery, Snackbar, Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import BlockIcon from '@mui/icons-material/Block';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../api/client';
import { errorMessage, formatMoney, getDisplayStatus } from '../utils/format';

const STRIPE = { PAID: '#10B981', PARTIALLY_PAID: '#0EA5E9', UNPAID: '#94A3B8', OVERDUE: '#EF4444', VOID: '#CBD5E1' };
import { PaymentStatusChip, LockedChip } from './StatusChip';
import PaymentDialog from './PaymentDialog';

/**
 * Invoice table (desktop) / cards (mobile) with every invoice action:
 * view PDF, edit, record payment, lock/unlock, void and delete.
 */
export default function InvoiceList({ bills, loading, emptyText, onBillUpdated, onBillDeleted, showClient = true }) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));

  const [menu, setMenu] = useState({ anchor: null, bill: null });
  const [paymentBill, setPaymentBill] = useState(null);
  const [toast, setToast] = useState(null);

  const [pdf, setPdf] = useState({ open: false, url: null, loading: false, invoiceNumber: '' });

  const closeMenu = () => setMenu({ anchor: null, bill: null });

  const runAction = async (bill, action, successMessage) => {
    closeMenu();
    try {
      const res = await api.patch(`/bills/${bill._id}`, { action });
      onBillUpdated(res.data.bill);
      setToast({ severity: 'success', message: successMessage });
    } catch (err) {
      setToast({ severity: 'error', message: errorMessage(err, `Failed to ${action} invoice`) });
    }
  };

  const handleVoid = (bill) => {
    if (!window.confirm(`Void invoice ${bill.invoiceNumber}? It stays on record but no longer counts towards what the client owes. This cannot be undone.`)) {
      closeMenu();
      return;
    }
    runAction(bill, 'void', 'Invoice voided');
  };

  const handleDelete = async (bill) => {
    closeMenu();
    if (!window.confirm(`Delete invoice ${bill.invoiceNumber} and its stored PDF permanently?`)) return;
    try {
      await api.delete('/bills', { params: { id: bill._id } });
      onBillDeleted(bill._id);
    } catch (err) {
      setToast({ severity: 'error', message: errorMessage(err, 'Failed to delete bill') });
    }
  };

  const handleOpenPdf = async (bill) => {
    setPdf({ open: true, url: null, loading: true, invoiceNumber: bill.invoiceNumber || 'invoice' });
    try {
      const res = await api.get(`/bills/${bill._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPdf((p) => ({ ...p, url, loading: false }));
    } catch (err) {
      let message = 'Failed to load PDF file';
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          if (parsed.message) message = parsed.message;
        } catch (_) { /* keep default message */ }
      }
      setToast({ severity: 'error', message });
      setPdf({ open: false, url: null, loading: false, invoiceNumber: '' });
    }
  };

  const closePdf = () => {
    if (pdf.url) URL.revokeObjectURL(pdf.url);
    setPdf({ open: false, url: null, loading: false, invoiceNumber: '' });
  };

  const downloadPdf = () => {
    const a = document.createElement('a');
    a.href = pdf.url;
    a.download = `${pdf.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isVoid = (bill) => bill.paymentStatus === 'VOID';
  const canEdit = (bill) => !bill.isLocked && !isVoid(bill);

  const renderActions = (bill) => (
    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.25}>
      <Tooltip title="View / download PDF">
        <IconButton size="small" color="primary" onClick={() => handleOpenPdf(bill)}>
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={canEdit(bill) ? 'Edit invoice' : 'Locked - unlock to edit'}>
        <span>
          <IconButton size="small" component={canEdit(bill) ? RouterLink : 'button'} to={canEdit(bill) ? `/edit/${bill._id}` : undefined} disabled={!canEdit(bill)}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Record payment">
        <span>
          <IconButton size="small" color="success" disabled={isVoid(bill)} onClick={() => setPaymentBill(bill)}>
            <PaymentsOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <IconButton size="small" aria-label="More actions" onClick={(e) => setMenu({ anchor: e.currentTarget, bill })}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  let content;
  if (loading) {
    content = <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;
  } else if (bills.length === 0) {
    content = <Typography align="center" color="text.secondary" sx={{ py: 6, px: 2 }}>{emptyText}</Typography>;
  } else if (compact) {
    content = (
      <Box display="flex" flexDirection="column" gap={1.5}>
        {bills.map((bill) => (
          <Paper key={bill._id} elevation={2} sx={{ p: 2, opacity: isVoid(bill) ? 0.7 : 1, borderLeft: `5px solid ${STRIPE[getDisplayStatus(bill)]}` }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Box minWidth={0}>
                <Typography fontWeight={700} color="#0F172A" noWrap>{bill.invoiceNumber}</Typography>
                {showClient && (
                  <Typography variant="body2" noWrap>{bill.billTo?.clientName || 'N/A'}</Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {bill.billDate}{bill.dueDate ? ` · due ${bill.dueDate}` : ''}
                </Typography>
              </Box>
              <Box textAlign="right" flexShrink={0}>
                <Typography fontWeight={700}>{formatMoney(bill.total, bill.currency)}</Typography>
                {bill.balanceDue > 0 && bill.balanceDue !== bill.total && (
                  <Typography variant="caption" color="text.secondary">{formatMoney(bill.balanceDue, bill.currency)} due</Typography>
                )}
              </Box>
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} flexWrap="wrap" gap={0.5}>
              <Box display="flex" gap={0.75} flexWrap="wrap">
                <PaymentStatusChip bill={bill} />
                {bill.isLocked && <LockedChip />}
              </Box>
              {renderActions(bill)}
            </Box>
          </Paper>
        ))}
      </Box>
    );
  } else {
    content = (
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(79,70,229,0.05)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Invoice #</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              {showClient && <TableCell sx={{ fontWeight: 600 }}>Billed To</TableCell>}
              <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Balance due</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bills.map((bill) => (
              <TableRow key={bill._id} hover sx={{ opacity: isVoid(bill) ? 0.6 : 1 }}>
                <TableCell sx={{ fontWeight: 600, color: '#0F172A' }}>{bill.invoiceNumber}</TableCell>
                <TableCell>
                  {bill.billDate}
                  {bill.dueDate && (
                    <Typography variant="caption" display="block" color="text.secondary">Due {bill.dueDate}</Typography>
                  )}
                </TableCell>
                {showClient && (
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{bill.billTo?.clientName || 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary">{bill.billTo?.clientEmail}</Typography>
                  </TableCell>
                )}
                <TableCell align="right" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {formatMoney(bill.total, bill.currency)}
                </TableCell>
                <TableCell align="right">{formatMoney(bill.balanceDue, bill.currency)}</TableCell>
                <TableCell>
                  <Box display="flex" gap={0.75} flexWrap="wrap">
                    <PaymentStatusChip bill={bill} />
                    {bill.isLocked && <LockedChip />}
                  </Box>
                </TableCell>
                <TableCell align="right">{renderActions(bill)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <>
      {content}

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}>
        {menu.bill?.isLocked ? (
          <MenuItem onClick={() => runAction(menu.bill, 'unlock', 'Invoice unlocked')}>
            <ListItemIcon><LockOpenIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Unlock</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => runAction(menu.bill, 'lock', 'Invoice locked')}>
            <ListItemIcon><LockIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Lock</ListItemText>
          </MenuItem>
        )}
        <MenuItem disabled={!menu.bill || isVoid(menu.bill)} onClick={() => handleVoid(menu.bill)}>
          <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Void invoice</ListItemText>
        </MenuItem>
        <MenuItem disabled={!menu.bill || menu.bill.isLocked} onClick={() => handleDelete(menu.bill)} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <PaymentDialog
        bill={paymentBill}
        onClose={() => setPaymentBill(null)}
        onSaved={(updated) => {
          onBillUpdated(updated);
          setPaymentBill(null);
          setToast({ severity: 'success', message: 'Payment recorded' });
        }}
      />

      <Dialog open={pdf.open} onClose={closePdf} maxWidth="md" fullWidth fullScreen={compact}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <span>Invoice PDF - {pdf.invoiceNumber}</span>
          {pdf.url && (
            <Button startIcon={<DownloadIcon />} variant="outlined" size="small" onClick={downloadPdf}>
              Download PDF
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 400, p: 0 }}>
          {pdf.loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}><CircularProgress /></Box>
          ) : pdf.url ? (
            <iframe src={pdf.url} title="Invoice PDF" width="100%" style={{ border: 'none', height: compact ? '75vh' : 550 }} />
          ) : (
            <Box p={3}>Unable to load PDF</Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={closePdf}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">{toast.message}</Alert> : undefined}
      </Snackbar>
    </>
  );
}
