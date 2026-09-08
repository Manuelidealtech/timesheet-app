import React, { useEffect, useRef } from "react";

function drawStoredSignature(canvas, dataUrl) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);

  if (!dataUrl) return;

  const image = new Image();
  image.onload = () => {
    const padding = 8;
    const maxWidth = Math.max(1, rect.width - padding * 2);
    const maxHeight = Math.max(1, rect.height - padding * 2);
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (rect.width - drawWidth) / 2;
    const y = (rect.height - drawHeight) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  };
  image.src = dataUrl;
}

export default function SignaturePad({ value = "", onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const hasSignature = Boolean(value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const redraw = () => drawStoredSignature(canvas, value);
    redraw();

    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [value]);

  function pointFromEvent(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function beginStroke(event) {
    if (disabled) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    drawingRef.current = true;
    dirtyRef.current = true;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.2;
  }

  function moveStroke(event) {
    if (disabled || !drawingRef.current) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = pointFromEvent(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endStroke(event) {
    if (!drawingRef.current) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    drawingRef.current = false;
    canvas?.releasePointerCapture?.(event.pointerId);

    if (!canvas || !dirtyRef.current) return;
    dirtyRef.current = false;
    const dataUrl = canvas.toDataURL("image/png");
    onChange?.(dataUrl);
  }

  function clearSignature() {
    if (disabled) return;
    onChange?.("");
    const canvas = canvasRef.current;
    if (canvas) drawStoredSignature(canvas, "");
  }

  return (
    <div className="signaturePadShell">
      <div className="signaturePadTopline">
        <div>
          <strong>Firma cliente</strong>
          <div className="sub">Firma direttamente con il dito, pennino o mouse.</div>
        </div>
        <div className="signaturePadActions">
          {hasSignature && <span className="signatureSavedBadge">Firma acquisita</span>}
          <button
            type="button"
            className="btn signatureClearBtn"
            onClick={clearSignature}
            disabled={disabled || !hasSignature}
          >
            Cancella firma
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={`signaturePadCanvas ${disabled ? "isDisabled" : ""}`}
        onPointerDown={beginStroke}
        onPointerMove={moveStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={(event) => {
          if (drawingRef.current && event.buttons === 0) endStroke(event);
        }}
        aria-label="Area firma cliente"
      />

      {!hasSignature && (
        <div className="signaturePadHint" aria-hidden="true">
          Firma qui
        </div>
      )}
    </div>
  );
}
