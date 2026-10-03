import React, { useRef, useState } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { prepareLogo } from '../utils/image';

const checkerboard = {
  backgroundColor: '#fff',
  backgroundImage: 'linear-gradient(45deg,#EEF2FF 25%,transparent 25%),linear-gradient(-45deg,#EEF2FF 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#EEF2FF 75%),linear-gradient(-45deg,transparent 75%,#EEF2FF 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
};

/** `value` is `{ mimeType, data(base64) }` or null; `onChange` receives the same shape. */
export default function LogoUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    try {
      onChange(await prepareLogo(file));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 2.5, flexDirection: { xs: 'column', sm: 'row' }, p: 2.5, borderRadius: 3,
          border: '2px dashed', borderColor: dragging ? 'primary.main' : 'rgba(99,102,241,0.35)',
          bgcolor: dragging ? 'rgba(79,70,229,0.06)' : 'rgba(255,255,255,0.7)', transition: 'all .2s ease',
        }}
      >
        <Box sx={{ width: { xs: '100%', sm: 220 }, height: 110, flexShrink: 0, borderRadius: 2, border: '1px solid rgba(99,102,241,0.2)', display: 'grid', placeItems: 'center', overflow: 'hidden', ...checkerboard }}>
          {value ? (
            <img src={`data:${value.mimeType};base64,${value.data}`} alt="Business logo" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
          ) : (
            <Typography variant="caption" color="text.secondary">No logo yet</Typography>
          )}
        </Box>
        <Box textAlign={{ xs: 'center', sm: 'left' }}>
          <Typography fontWeight={700}>Business logo</Typography>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Drag an image here or browse. It appears in the header, footer and as a faint watermark on every invoice PDF.
          </Typography>
          <Box display="flex" gap={1} justifyContent={{ xs: 'center', sm: 'flex-start' }} flexWrap="wrap">
            <Button variant="contained" startIcon={<CloudUploadOutlinedIcon />} onClick={() => inputRef.current?.click()}>
              {value ? 'Replace logo' : 'Upload logo'}
            </Button>
            {value && (
              <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onChange(null)}>Remove</Button>
            )}
          </Box>
        </Box>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    </Box>
  );
}
