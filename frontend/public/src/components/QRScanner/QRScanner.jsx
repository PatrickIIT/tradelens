// frontend/src/components/QRScanner/QRScanner.jsx
//
// Camera-based QR code scanner for TradeLens border verification (US-05, BR-03).
// Used exclusively in CustomsVerify.jsx — customs officers scan a trader's
// certificate QR code at the border checkpoint.
//
// On a successful decode the raw QR payload string is passed to onScan(payload),
// which CustomsVerify then POSTs to POST /api/verify/qr.
//
// Dependencies: jsqr  (npm install jsqr)
//
// Props:
//   onScan   (payload: string) => void   — called once on first clean decode
//   onError  (message: string) => void   — called on camera/permission errors
//   onClose  ()               => void    — called when officer dismisses scanner

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

// ── How often (ms) we sample a video frame for QR data ───────────────────────
const SCAN_INTERVAL_MS = 250;

// ── Error messages ─────────────────────────────────────────────────────────────
const ERRORS = {
  PERMISSION_DENIED:
    'Camera access was denied. Please allow camera permission in your browser settings and try again.',
  NO_CAMERA:
    'No camera was found on this device. Use the manual input field below instead.',
  INSECURE_CONTEXT:
    'Camera access requires a secure connection (HTTPS). Use the manual input field below.',
  NOT_SUPPORTED:
    'Your browser does not support camera access. Please use Chrome or Safari and try again.',
  GENERIC:
    'Could not start the camera. Use the manual input field below instead.',
};

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = () => (
  <span
    style={{
      display: 'inline-block',
      width: '18px',
      height: '18px',
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'qr-spin 0.7s linear infinite',
      flexShrink: 0,
    }}
  />
);

// ── Main component ────────────────────────────────────────────────────────────
const QRScanner = ({ onScan, onError, onClose }) => {
  const videoRef      = useRef(null);   // <video> element
  const canvasRef     = useRef(null);   // offscreen <canvas> for frame sampling
  const streamRef     = useRef(null);   // MediaStream — stopped on unmount
  const intervalRef   = useRef(null);   // setInterval handle
  const hasScannedRef = useRef(false);  // prevents firing onScan more than once

  const [status, setStatus]         = useState('requesting'); // 'requesting' | 'active' | 'error' | 'scanned'
  const [errorMsg, setErrorMsg]     = useState('');
  const [torchOn, setTorchOn]       = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [lastPayload, setLastPayload] = useState('');

  // ── Stop camera + scanning ─────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    hasScannedRef.current = false;
    setStatus('requesting');
    setErrorMsg('');

    // Require secure context for getUserMedia
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setStatus('error');
      setErrorMsg(ERRORS.INSECURE_CONTEXT);
      onError?.(ERRORS.INSECURE_CONTEXT);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMsg(ERRORS.NOT_SUPPORTED);
      onError?.(ERRORS.NOT_SUPPORTED);
      return;
    }

    try {
      // Prefer rear camera on mobile (environment) — better for scanning docs
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check torch (flashlight) support
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack?.getCapabilities?.() ?? {};
      setTorchSupported(!!capabilities.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('active');
        beginScanning();
      }
    } catch (err) {
      let msg = ERRORS.GENERIC;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = ERRORS.PERMISSION_DENIED;
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = ERRORS.NO_CAMERA;
      } else if (err.name === 'NotSupportedError') {
        msg = ERRORS.NOT_SUPPORTED;
      }

      setStatus('error');
      setErrorMsg(msg);
      onError?.(msg);
    }
  }, [onError]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frame sampling + jsQR decode ─────────────────────────────────────────
  const beginScanning = useCallback(() => {
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const { videoWidth: w, videoHeight: h } = video;
      if (!w || !h) return;

      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, {
        inversionAttempts: 'dontInvert', // faster for printed QR codes
      });

      if (code?.data && !hasScannedRef.current) {
        hasScannedRef.current = true;
        setLastPayload(code.data);
        setStatus('scanned');
        stopCamera();
        onScan?.(code.data);
      }
    }, SCAN_INTERVAL_MS);
  }, [onScan, stopCamera]);

  // ── Torch toggle ──────────────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      await videoTrack.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch {
      // torch constraint unsupported on this device/browser
    }
  }, [torchOn]);

  // ── Rescan ────────────────────────────────────────────────────────────────
  const handleRescan = useCallback(() => {
    setLastPayload('');
    startCamera();
  }, [startCamera]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes qr-spin { to { transform: rotate(360deg); } }
        @keyframes qr-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes qr-scan-line {
          0%   { top: 12%; }
          50%  { top: 82%; }
          100% { top: 12%; }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR code scanner"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          padding: '16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: '#fff',
            borderRadius: '20px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}
        >

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                Scan Certificate QR
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                Border Verification · BR-03 · under 30 s
              </p>
            </div>

            <button
              onClick={() => { stopCamera(); onClose?.(); }}
              aria-label="Close scanner"
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* ── Camera viewport ─────────────────────────────────────────── */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              background: '#111',
              overflow: 'hidden',
            }}
          >
            {/* Video feed */}
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: status === 'active' ? 'block' : 'none',
              }}
            />

            {/* Offscreen canvas — never visible */}
            <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />

            {/* ── Requesting permission overlay ─────────────────────────── */}
            {status === 'requesting' && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '14px', color: '#fff',
                }}
              >
                <Spinner />
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                  Requesting camera access…
                </p>
              </div>
            )}

            {/* ── Active scan overlay ───────────────────────────────────── */}
            {status === 'active' && (
              <>
                {/* Corner brackets — scan window */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '10%', left: '10%',
                    width: '80%', height: '80%',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Top-left */}
                  <span style={{ position:'absolute', top:0, left:0,
                    width:'28px', height:'28px',
                    borderTop: '3px solid #4ade80', borderLeft: '3px solid #4ade80',
                    borderRadius: '2px 0 0 0' }} />
                  {/* Top-right */}
                  <span style={{ position:'absolute', top:0, right:0,
                    width:'28px', height:'28px',
                    borderTop: '3px solid #4ade80', borderRight: '3px solid #4ade80',
                    borderRadius: '0 2px 0 0' }} />
                  {/* Bottom-left */}
                  <span style={{ position:'absolute', bottom:0, left:0,
                    width:'28px', height:'28px',
                    borderBottom: '3px solid #4ade80', borderLeft: '3px solid #4ade80',
                    borderRadius: '0 0 0 2px' }} />
                  {/* Bottom-right */}
                  <span style={{ position:'absolute', bottom:0, right:0,
                    width:'28px', height:'28px',
                    borderBottom: '3px solid #4ade80', borderRight: '3px solid #4ade80',
                    borderRadius: '0 0 2px 0' }} />

                  {/* Animated scan line */}
                  <span
                    style={{
                      position: 'absolute',
                      left: '4px', right: '4px',
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #4ade80, transparent)',
                      borderRadius: '999px',
                      animation: 'qr-scan-line 2s ease-in-out infinite',
                    }}
                  />
                </div>

                {/* Status pill */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    padding: '5px 14px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backdropFilter: 'blur(4px)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '6px', height: '6px',
                      borderRadius: '50%',
                      background: '#4ade80',
                      animation: 'qr-pulse 1.2s ease-in-out infinite',
                    }}
                  />
                  Scanning…
                </div>

                {/* Torch button */}
                {torchSupported && (
                  <button
                    onClick={toggleTorch}
                    aria-label={torchOn ? 'Turn torch off' : 'Turn torch on'}
                    title={torchOn ? 'Torch on' : 'Torch off'}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: torchOn ? '#fbbf24' : 'rgba(0,0,0,0.5)',
                      border: 'none',
                      borderRadius: '8px',
                      width: '36px',
                      height: '36px',
                      cursor: 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    🔦
                  </button>
                )}
              </>
            )}

            {/* ── Scanned success overlay ───────────────────────────────── */}
            {status === 'scanned' && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '56px', height: '56px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '26px',
                  }}
                >
                  ✓
                </div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  QR Code Detected
                </p>
                <p style={{
                  margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)',
                  maxWidth: '240px', textAlign: 'center',
                  fontFamily: "'Courier New', monospace",
                  wordBreak: 'break-all',
                  padding: '0 16px',
                }}>
                  {lastPayload.length > 60
                    ? `${lastPayload.slice(0, 60)}…`
                    : lastPayload}
                </p>
              </div>
            )}

            {/* ── Error overlay ─────────────────────────────────────────── */}
            {status === 'error' && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: '#111',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '12px', padding: '24px',
                }}
              >
                <div
                  style={{
                    width: '48px', height: '48px',
                    borderRadius: '50%',
                    background: '#fef2f2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px',
                  }}
                >
                  ⚠
                </div>
                <p style={{
                  margin: 0, fontSize: '13px', color: '#f87171',
                  textAlign: 'center', lineHeight: 1.5,
                }}>
                  {errorMsg}
                </p>
                <button
                  onClick={startCamera}
                  style={{
                    marginTop: '4px',
                    padding: '8px 20px',
                    background: '#fff',
                    color: '#111',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {/* Instruction / status text */}
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', flex: 1 }}>
              {status === 'requesting' && 'Waiting for camera…'}
              {status === 'active'     && 'Point the camera at a TradeLens certificate QR code.'}
              {status === 'scanned'    && 'Payload captured. Sending to verifier…'}
              {status === 'error'      && 'Camera unavailable — use manual input.'}
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Rescan button — shown after a successful scan */}
              {status === 'scanned' && (
                <button
                  onClick={handleRescan}
                  style={{
                    padding: '8px 14px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ↺ Rescan
                </button>
              )}

              {/* Manual input fallback */}
              <button
                onClick={() => { stopCamera(); onClose?.(); }}
                style={{
                  padding: '8px 14px',
                  background: status === 'error' ? '#111827' : '#f3f4f6',
                  color: status === 'error' ? '#fff' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {status === 'error' ? 'Use Manual Input' : 'Cancel'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default QRScanner;
