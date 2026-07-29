import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

interface BottomSheetModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. "540px"
  className?: string;
  showHandle?: boolean;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidth = '560px',
  className = '',
  showHandle = true,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Animate in after mount
  useEffect(() => {
    if (open) {
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
    }
  }, [open]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  if (!open || !mounted) return null;

  // Touch drag-down handlers for mobile sheet — only allow drag from handle area
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow drag from the handle/header area, not content
    const target = e.target as HTMLElement;
    if (contentRef.current && contentRef.current.contains(target)) {
      // Check if content is scrolled to top - only allow drag if at top
      if (contentRef.current.scrollTop > 0) return;
    }
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      // Only track downward drag
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentY > 100) {
      // Dismiss if dragged down more than 100px
      onClose();
    }
    setCurrentY(0);
    setStartY(null);
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 999999,
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
        transition: 'background-color 0.3s ease',
      }}
      className="bsm-overlay"
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: maxWidth,
          backgroundColor: 'var(--color-white)',
          color: 'var(--color-gray-900)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--color-gray-300)',
          borderBottom: 'none',
          transform: isDragging && currentY > 0
            ? `translateY(${currentY}px)`
            : isVisible
              ? 'translateY(0)'
              : 'translateY(100%)',
          transition: isDragging
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: 'hidden',
          willChange: 'transform',
        }}
        className={`bsm-sheet ${className}`}
      >
        {/* Mobile Pull Handle Pill Indicator */}
        {showHandle && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 12,
              paddingBottom: 4,
              backgroundColor: 'var(--color-white)',
              cursor: 'grab',
              flexShrink: 0,
              userSelect: 'none',
            }}
            className="bsm-handle"
          >
            <div style={{
              width: 40,
              height: 5,
              borderRadius: 999,
              backgroundColor: 'var(--color-gray-400)',
            }} />
          </div>
        )}

        {/* Modal Header */}
        {title && (
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-gray-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-white)',
              flexShrink: 0,
            }}
            className="bsm-header"
          >
            <div style={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: 'var(--color-gray-900)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingRight: 8,
            }}>
              {title}
            </div>
            <button
              onClick={onClose}
              style={{
                padding: 6,
                color: 'var(--color-gray-500)',
                borderRadius: 8,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s, background 0.2s',
                flexShrink: 0,
              }}
              title="Close"
              type="button"
            >
              <FiX size={20} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div
          ref={contentRef}
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: 'var(--color-white)',
            color: 'var(--color-gray-900)',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
          className="bsm-body"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BottomSheetModal;
