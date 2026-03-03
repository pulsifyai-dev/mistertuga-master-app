'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { PDF_LOADING_MESSAGES, MAX_ORDERS_PER_PDF } from '../types';

interface ExportControlsProps {
  isExporting: boolean;
  exportChunksInfo: { totalChunks: number; totalOrders: number } | null;
}

export function ExportOverlay({ isExporting, exportChunksInfo }: ExportControlsProps) {
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [typedLoadingText, setTypedLoadingText] = useState('');
  const [showSplitNotice, setShowSplitNotice] = useState(false);

  // Typewriter effect
  useEffect(() => {
    if (!isExporting) {
      setTypedLoadingText('');
      setLoadingMessageIndex(0);
      return;
    }
    if (showSplitNotice) return;

    const fullText = PDF_LOADING_MESSAGES[loadingMessageIndex] ?? '';
    const typeSpeed = 40;
    const holdMs = 2000;

    let charIndex = 0;
    let cancelled = false;

    setTypedLoadingText('');

    const typeNextChar = () => {
      if (cancelled) return;
      if (charIndex < fullText.length) {
        charIndex += 1;
        setTypedLoadingText(fullText.slice(0, charIndex));
        window.setTimeout(typeNextChar, typeSpeed);
      } else {
        window.setTimeout(() => {
          if (cancelled) return;
          setLoadingMessageIndex((prev) => (prev + 1) % PDF_LOADING_MESSAGES.length);
        }, holdMs);
      }
    };

    typeNextChar();
    return () => { cancelled = true; };
  }, [isExporting, loadingMessageIndex, showSplitNotice]);

  // Split notice
  useEffect(() => {
    if (!isExporting) {
      setShowSplitNotice(false);
      return;
    }
    if (!exportChunksInfo || exportChunksInfo.totalChunks <= 1) {
      setShowSplitNotice(false);
      return;
    }
    setShowSplitNotice(true);
    const t = window.setTimeout(() => setShowSplitNotice(false), 3000);
    return () => window.clearTimeout(t);
  }, [isExporting, exportChunksInfo?.totalChunks]);

  if (!isExporting) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 px-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-white" />
      {showSplitNotice && exportChunksInfo && exportChunksInfo.totalChunks > 1 ? (
        <>
          <p className="text-white text-xl font-bold">
            This export will generate {exportChunksInfo.totalChunks} PDF files.
          </p>
          <p className="text-white/80 text-sm">Up to {MAX_ORDERS_PER_PDF} orders per file.</p>
        </>
      ) : (
        <>
          <p className="text-white text-lg font-semibold flex items-center justify-center">
            {typedLoadingText || PDF_LOADING_MESSAGES[loadingMessageIndex]}
            <span className="ml-1 inline-block w-[8px] h-[18px] bg-white/80 animate-pulse rounded-[1px]" />
          </p>
          <p className="text-white/70 text-xs">This might take a few seconds, don&apos;t refresh.</p>
        </>
      )}
    </div>
  );
}
