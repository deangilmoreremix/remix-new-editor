'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface ConnectAccountButtonProps {
  platformName: string
  platformIcon: React.ComponentType<any>
  platformAccent: string
  connecting: boolean
  disabled: boolean
  onClick: () => void
}

export default function ConnectAccountButton({
  platformName,
  platformIcon: Icon,
  platformAccent,
  connecting,
  disabled,
  onClick,
}: ConnectAccountButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || connecting}
      className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      style={{
        backgroundColor: `${platformAccent}18`,
        color: platformAccent,
      }}
    >
      {connecting ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Icon size={14} style={{ color: platformAccent }} />
      )}
      Connect {platformName} account
    </button>
  )
}
