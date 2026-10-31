import React, { useState, useEffect } from "react";
import { QrCode, RefreshCw, Smartphone, Check, ShieldCheck } from "lucide-react";

export function QRCodePanel({ qrData, onRefresh, loading }) {
  const [copied, setCopied] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!qrData?.timestamp) return;
    const update = () => {
      const sec = Math.floor((Date.now() - qrData.timestamp) / 1000);
      setSecondsAgo(Math.max(0, sec));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [qrData?.timestamp]);

  if (!qrData?.qr) return null;

  return (
    <div className="qr-panel-container">
      <div className="qr-box-card">
        <div className="qr-image-wrapper">
          <img src={qrData.qr} alt="WhatsApp QR Code" className="qr-image" />
          {loading && (
            <div className="qr-overlay-loading">
              <RefreshCw size={32} className="spin-icon" />
              <span>Updating code...</span>
            </div>
          )}
        </div>

        <div className="qr-meta-bar">
          <span className="qr-live-indicator">
            <span className="live-dot-pulse" /> Live QR Code
          </span>
          {qrData.timestamp && (
            <span className="qr-age">Updated {secondsAgo}s ago</span>
          )}
          <button
            className="secondary-button qr-refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            title="Request fresh QR code"
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} /> Refresh QR
          </button>
        </div>
      </div>

      <div className="qr-instructions-card">
        <div className="instructions-header">
          <Smartphone size={24} className="instruction-icon" />
          <div>
            <h3>Scan with WhatsApp</h3>
            <p>Connect your account in seconds</p>
          </div>
        </div>

        <ol className="instructions-steps">
          <li>
            <span className="step-num">1</span>
            <div>
              <strong>Open WhatsApp</strong>
              <p>On your phone, open the WhatsApp mobile application.</p>
            </div>
          </li>
          <li>
            <span className="step-num">2</span>
            <div>
              <strong>Open Linked Devices</strong>
              <p>Tap <em>Menu (⋮)</em> on Android or <em>Settings (⚙)</em> on iPhone, then tap <strong>Linked Devices</strong>.</p>
            </div>
          </li>
          <li>
            <span className="step-num">3</span>
            <div>
              <strong>Select Link a Device</strong>
              <p>Point your phone's camera at this screen to capture the code.</p>
            </div>
          </li>
          <li>
            <span className="step-num">4</span>
            <div>
              <strong>Automatic Pairing</strong>
              <p>Once scanned, the connector will authenticate and synchronize automatically.</p>
            </div>
          </li>
        </ol>

        <div className="security-notice">
          <ShieldCheck size={18} />
          <span>Multi-file authentication session is persisted locally on your server.</span>
        </div>
      </div>
    </div>
  );
}

export default QRCodePanel;
