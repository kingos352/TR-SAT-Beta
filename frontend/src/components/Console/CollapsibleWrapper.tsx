import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

interface CollapsibleWrapperProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  keepMounted?: boolean;
}

const CollapsibleWrapperInner: React.FC<CollapsibleWrapperProps> = ({
  title,
  icon: Icon,
  children,
  isOpen = false,
  onToggle,
  keepMounted = false,
}) => (
  <div style={{ flexShrink: 0 }}>
    <div
      onClick={onToggle}
      className={`collapsible-header${isOpen ? ' collapsible-header--open' : ''}`}
    >
      {Icon && (
        <Icon
          size={15}
          strokeWidth={1.75}
          color={isOpen ? 'var(--accent-blue)' : 'var(--text-muted)'}
        />
      )}
      <span style={{ flex: 1 }}>{title}</span>
      <span
        className="collapsible-arrow"
        style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <ChevronRight size={13} strokeWidth={2} />
      </span>
    </div>

    {(isOpen || keepMounted) && (
      <div
        style={{
          padding: '4px 12px 12px 12px',
          display: isOpen ? 'block' : 'none',
          animation: isOpen ? 'accordion-open 200ms ease' : undefined,
        }}
      >
        {children}
      </div>
    )}
  </div>
);

export const CollapsibleWrapper = React.memo(CollapsibleWrapperInner);
