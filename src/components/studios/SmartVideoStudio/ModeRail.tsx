/**
 * SmartVideo Studio — ModeRail
 *
 * Vertical mode switcher on the far left: Image, Video, Audio, Avatar, 3D, Tools.
 */

import React from 'react';
import { STUDIO_TABS, type ModelMeta } from './svStudio/modelRegistry';

interface ModeRailProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  modelsByTab: Record<string, ModelMeta[]>;
}

export default function ModeRail({ activeTab, onTabChange, modelsByTab }: ModeRailProps) {
  return (
    <nav className="mode-rail" aria-label="Studio modes">
      {STUDIO_TABS.map(tab => {
        const isActive = activeTab === tab.id;
        const modelCount = modelsByTab[tab.id]?.length || 0;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`mode-rail-item ${isActive ? 'is-active' : ''}`}
            aria-current={isActive ? 'true' : undefined}
            title={`${tab.label}${modelCount > 0 ? ` (${modelCount})` : ''}`}
          >
            <span className="mode-rail-icon">
              {tab.icon === 'image' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
              {tab.icon === 'video' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              )}
              {tab.icon === 'audio' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              )}
              {tab.icon === 'avatar' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                  <path d="M12 11v2" />
                  <path d="M8 14c1 1 4 1 8 0" />
                </svg>
              )}
              {tab.icon === 'cube' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              )}
              {tab.icon === 'wrench' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
              )}
            </span>
            {isActive && <span className="mode-rail-label">{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
