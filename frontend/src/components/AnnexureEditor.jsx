import React, { useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, Menu, MenuItem, Paper, Radio, RadioGroup, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { MAX_COLUMNS, MAX_ROWS, parsePasted, looksLikeHeader, applyImport, presetAnnexure } from '../utils/tabular';

const PLACEHOLDER = 'Copy cells in Excel / Google Sheets (with the header row) and paste here…\n\nDate\tHours\tDescription\tTask\n07/06/2026\t1\tChirag Shah Entry\tProduction Support';

export default function AnnexureEditor({ value, onChange }) {
  const [pasteText, setPasteText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [headerTouched, setHeaderTouched] = useState(false);
  const [append, setAppend] = useState(false);
  const [presetAnchor, setPresetAnchor] = useState(null);

  const grid = useMemo(() => parsePasted(pasteText), [pasteText]);
  const set = (patch) => onChange({ ...value, ...patch });

  const handlePasteText = (text) => {
    setPasteText(text);
    if (!headerTouched) setHasHeader(looksLikeHeader(parsePasted(text)));
  };

  const runImport = () => {
    if (grid.length === 0) return;
    onChange(applyImport(value, grid, { hasHeader, append }));
    setPasteText('');
    setHeaderTouched(false);
  };

  const setCell = (r, c, text) => set({ rows: value.rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? text : cell)) : row)) });
  const addRow = () => value.rows.length < MAX_ROWS && set({ rows: [...value.rows, value.columns.map(() => '')] });
  const removeRow = (r) => set({ rows: value.rows.length === 1 ? [value.columns.map(() => '')] : value.rows.filter((_, i) => i !== r) });
  const addColumn = () => value.columns.length < MAX_COLUMNS && set({
    columns: [...value.columns, { label: `Column ${value.columns.length + 1}`, align: 'left', total: false }],
    rows: value.rows.map((row) => [...row, '']),
  });
  const removeColumn = (c) => value.columns.length > 1 && set({ columns: value.columns.filter((_, i) => i !== c), rows: value.rows.map((row) => row.filter((_, j) => j !== c)) });
  const setColumn = (c, patch) => set({ columns: value.columns.map((col, i) => (i === c ? { ...col, ...patch } : col)) });

  // Pasting several cells into a grid cell spreads them out spreadsheet-style from that cell.
  const handleCellPaste = (e, r, c) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text)) return;
    const data = parsePasted(text);
    if (data.length === 0) return;
    e.preventDefault();
    const rows = value.rows.map((row) => [...row]);
    data.forEach((line, i) => {
      if (r + i >= MAX_ROWS) return;
      while (rows.length <= r + i) rows.push(value.columns.map(() => ''));
      line.forEach((cell, j) => { if (c + j < value.columns.length) rows[r + i][c + j] = cell; });
    });
    set({ rows });
  };

  const filledRows = value.rows.filter((r) => r.some((c) => c !== '')).length;

  return (
    <Box mt={3}>
      <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" mb={2}>
        <ToggleButtonGroup size="small" exclusive value={value.mode} onChange={(_, m) => m && set({ mode: m })}>
          <ToggleButton value="table">Table</ToggleButton>
          <ToggleButton value="text">Free text</ToggleButton>
        </ToggleButtonGroup>
        <TextField size="small" label="Annexure title" value={value.title} onChange={(e) => set({ title: e.target.value })} sx={{ minWidth: 240, flexGrow: 1 }} inputProps={{ maxLength: 80 }} />
        {value.mode === 'table' && (
          <>
            <Button size="small" variant="outlined" onClick={(e) => setPresetAnchor(e.currentTarget)}>Start from preset</Button>
            <Menu anchorEl={presetAnchor} open={Boolean(presetAnchor)} onClose={() => setPresetAnchor(null)}>
              <MenuItem onClick={() => { onChange(presetAnnexure('timesheet')); setPresetAnchor(null); }}>Timesheet (Date, Hours, Description, Task)</MenuItem>
              <MenuItem onClick={() => { onChange(presetAnnexure('deliverables')); setPresetAnchor(null); }}>Deliverables (Sr No, Description, Remarks)</MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {value.mode === 'text' ? (
        <TextField
          fullWidth multiline minRows={8}
          label="Annexure text"
          helperText="Blank line = new paragraph. Start a line with “- ” for a bullet."
          value={value.text}
          onChange={(e) => set({ text: e.target.value })}
          inputProps={{ maxLength: 20000 }}
        />
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fff' }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <ContentPasteIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={700}>Paste from Excel / Google Sheets / CSV</Typography>
            </Box>
            <TextField fullWidth multiline minRows={3} maxRows={8} placeholder={PLACEHOLDER} value={pasteText} onChange={(e) => handlePasteText(e.target.value)} InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
            {grid.length > 0 && (
              <Box display="flex" alignItems="center" flexWrap="wrap" gap={2} mt={1}>
                <Typography variant="body2" color="text.secondary">
                  Detected {grid.length - (hasHeader ? 1 : 0)} rows × {grid[0].length} columns
                </Typography>
                <FormControlLabel control={<Checkbox size="small" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); setHeaderTouched(true); }} />} label="First row is header" />
                <RadioGroup row value={append ? 'append' : 'replace'} onChange={(e) => setAppend(e.target.value === 'append')}>
                  <FormControlLabel value="replace" control={<Radio size="small" />} label="Replace rows" />
                  <FormControlLabel value="append" control={<Radio size="small" />} label="Append rows" />
                </RadioGroup>
                <Button variant="contained" size="small" onClick={runImport}>Import</Button>
              </Box>
            )}
            {(grid.length - (hasHeader ? 1 : 0) > MAX_ROWS || (grid[0]?.length || 0) > MAX_COLUMNS) && (
              <Alert severity="warning" sx={{ mt: 1 }}>Limit is {MAX_ROWS} rows and {MAX_COLUMNS} columns; extra data will be dropped.</Alert>
            )}
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1, maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }} align="center">#</TableCell>
                  {value.columns.map((col, c) => (
                    <TableCell key={c} sx={{ minWidth: 110, bgcolor: '#F1F5F9', verticalAlign: 'top' }}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <TextField variant="standard" size="small" value={col.label} onChange={(e) => setColumn(c, { label: e.target.value })} inputProps={{ style: { fontWeight: 600 }, maxLength: 40 }} />
                        <IconButton size="small" disabled={value.columns.length === 1} onClick={() => removeColumn(c)}><DeleteOutlineIcon fontSize="inherit" /></IconButton>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Tooltip title="Add up this column and show a total row (e.g. Hours)">
                          <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" sx={{ p: 0.5 }} checked={col.total} onChange={(e) => setColumn(c, { total: e.target.checked })} />} label={<Typography variant="caption">Σ total</Typography>} />
                        </Tooltip>
                        <TextField select variant="standard" size="small" value={col.align} onChange={(e) => setColumn(c, { align: e.target.value })} sx={{ minWidth: 56 }} SelectProps={{ sx: { fontSize: 12 } }}>
                          <MenuItem value="left">Left</MenuItem>
                          <MenuItem value="center">Center</MenuItem>
                          <MenuItem value="right">Right</MenuItem>
                        </TextField>
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell sx={{ width: 40, bgcolor: '#F1F5F9' }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {value.rows.map((row, r) => (
                  <TableRow key={r}>
                    <TableCell align="center"><Typography variant="caption" color="text.secondary">{r + 1}</Typography></TableCell>
                    {row.map((cell, c) => (
                      <TableCell key={c} sx={{ py: 0.5 }}>
                        <TextField fullWidth size="small" multiline maxRows={3} value={cell} onChange={(e) => setCell(r, c, e.target.value)} onPaste={(e) => handleCellPaste(e, r, c)} inputProps={{ maxLength: 500, style: { textAlign: value.columns[c].align } }} />
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ py: 0.5 }}>
                      <IconButton size="small" color="error" onClick={() => removeRow(r)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addRow} disabled={value.rows.length >= MAX_ROWS}>Add row</Button>
            <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addColumn} disabled={value.columns.length >= MAX_COLUMNS}>Add column</Button>
            <Button size="small" color="error" onClick={() => set({ rows: [value.columns.map(() => '')] })}>Clear rows</Button>
            <Typography variant="caption" color="text.secondary" ml="auto">{filledRows} row{filledRows === 1 ? '' : 's'} · tip: paste multiple cells straight into any cell</Typography>
          </Box>
        </>
      )}
    </Box>
  );
}
