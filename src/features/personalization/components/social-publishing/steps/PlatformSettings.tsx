'use client';

import React from 'react';
import { PLACEMENTS, TIKTOK_PRIVACY, X_REPLY_SETTINGS, YOUTUBE_PRIVACY, type PlatformId } from '@ohb/shared/api/socialPayloads';

interface Props {
  platform: PlatformId
  mediaType: 'video' | 'image'
  settings: Record<string, any>
  onChange: (key: string, value: any) => void
}

const label = 'block text-[10px] font-bold text-white/30 mb-1 uppercase tracking-wide';
const field = 'w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d9ff00]/50';

const YT_CATEGORIES: Array<[string, string]> = [
  ['22', 'People & Blogs'], ['1', 'Film & Animation'], ['10', 'Music'], ['20', 'Gaming'],
  ['23', 'Comedy'], ['27', 'Education'], ['28', 'Science & Technology'],
];

const TT_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends (mutual follows)', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me',
};
const PLACEMENT_LABEL: Record<string, string> = { reels: 'Reels', stories: 'Stories', timeline: 'Main feed / timeline' };
const REPLY_LABEL: Record<string, string> = { everyone: 'Everyone', accounts_you_follow: 'Accounts you follow', followers_only: 'Followers only' };

function Select({ id, text, value, options, onChange }: { id: string; text: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={label}>{text}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} appearance-none`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Check({ id, text, checked, onChange }: { id: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-white/70">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
      {text}
    </label>
  );
}

/** Options MuAPI actually documents for each platform — nothing else is offered. */
export default function PlatformSettings({ platform, mediaType, settings, onChange }: Props) {
  const id = (k: string) => `ps-${platform}-${k}`;
  switch (platform) {
    case 'youtube':
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select id={id('privacy')} text="Privacy" value={settings.privacy || 'public'} options={YOUTUBE_PRIVACY.map((p) => [p, p[0].toUpperCase() + p.slice(1)])} onChange={(v) => onChange('privacy', v)} />
            <Select id={id('cat')} text="Category" value={settings.category_id || '22'} options={YT_CATEGORIES} onChange={(v) => onChange('category_id', v)} />
          </div>
          <div>
            <label htmlFor={id('tags')} className={label}>Tags</label>
            <input id={id('tags')} value={settings.tags || ''} onChange={(e) => onChange('tags', e.target.value)} placeholder="tag1, tag2, tag3" className={field} />
          </div>
          <Check id={id('kids')} text="Made for kids" checked={settings.made_for_kids === true} onChange={(v) => onChange('made_for_kids', v)} />
        </div>
      );
    case 'instagram':
      return mediaType === 'video' ? (
        <div className="space-y-2">
          <Select id={id('placement')} text="Placement" value={settings.placement || 'reels'} options={PLACEMENTS.map((p) => [p, PLACEMENT_LABEL[p]])} onChange={(v) => onChange('placement', v)} />
          <Check id={id('feed')} text="Also share to feed" checked={settings.share_to_feed !== false} onChange={(v) => onChange('share_to_feed', v)} />
          <p className="text-[11px] text-white/40">Instagram Business accounts only. Your thumbnail (if you made one) is used as the cover.</p>
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Images are posted to the feed of your Instagram Business account. No extra options.</p>
      );
    case 'tiktok':
      return (
        <div className="space-y-2">
          <Select id={id('privacy')} text="Who can view" value={settings.privacy_level || 'PUBLIC_TO_EVERYONE'} options={TIKTOK_PRIVACY.map((p) => [p, TT_LABEL[p]])} onChange={(v) => onChange('privacy_level', v)} />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Check id={id('c')} text="Turn off comments" checked={settings.disable_comment === true} onChange={(v) => onChange('disable_comment', v)} />
            <Check id={id('d')} text="Turn off duet" checked={settings.disable_duet === true} onChange={(v) => onChange('disable_duet', v)} />
            <Check id={id('s')} text="Turn off stitch" checked={settings.disable_stitch === true} onChange={(v) => onChange('disable_stitch', v)} />
          </div>
        </div>
      );
    case 'facebook':
      return <Select id={id('placement')} text="Placement" value={settings.placement || 'timeline'} options={PLACEMENTS.map((p) => [p, PLACEMENT_LABEL[p]])} onChange={(v) => onChange('placement', v)} />;
    case 'threads':
      return <Select id={id('placement')} text="Placement" value={settings.placement || 'timeline'} options={[['timeline', PLACEMENT_LABEL.timeline], ['reels', PLACEMENT_LABEL.reels]]} onChange={(v) => onChange('placement', v)} />;
    case 'pinterest':
      return (
        <div className="space-y-2">
          <div>
            <label htmlFor={id('board')} className={label}>Board ID (blank = default board)</label>
            <input id={id('board')} value={settings.board_id || ''} onChange={(e) => onChange('board_id', e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor={id('link')} className={label}>Destination link</label>
            <input id={id('link')} value={settings.link || ''} onChange={(e) => onChange('link', e.target.value)} placeholder="https://" className={field} />
          </div>
        </div>
      );
    case 'x':
      return <Select id={id('reply')} text="Who can reply" value={settings.reply_settings || 'everyone'} options={X_REPLY_SETTINGS.map((p) => [p, REPLY_LABEL[p]])} onChange={(v) => onChange('reply_settings', v)} />;
    default:
      return <p className="text-[11px] text-white/40">No extra options for this platform.</p>;
  }
}
