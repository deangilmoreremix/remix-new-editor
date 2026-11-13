/**
 * Adapter for the upstream `community-chat` template.
 *
 * Upstream: `src/components/community-chat/CommunityChat.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A generic team-chat window (workspace rail, channel list, message area)
 * tilts in 3D while messages pop in one after the other. It is a chat
 * mock-up whose background IS the design, so it is registered as a
 * `full-scene` intro card.
 *
 * Messages are built ONLY from the customer's own copy, all posted by the
 * business itself (headline → offer → call to action + website/phone). No
 * invented customer replies, no reaction counts and no fake timestamps are
 * added. The upstream's neutral teal accent, its dark window palette and the
 * placeholder workspace icons ("A", "B", "C") are module constants and are
 * not switchable through props.
 */

import React from 'react'
import { CommunityChat, type CommunityChatMessage } from '../../_upstream/community-chat/CommunityChat'
import { useDesignFonts } from '../fonts'
import { DesignStage, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, brandPalette, deepShade, scopeSelector, useScopeId } from './batch3aShared'

const MAX_NAME_LENGTH = 24
const MAX_MESSAGE_LENGTH = 90

export const CommunityChatDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('community-chat')
  const palette = brandPalette(props)
  // The upstream's app background is a module constant; a stylesheet scoped
  // to this instance swaps it for a deep shade of the brand colour.
  const css = `${scopeSelector(scopeId)} > div:first-child { background: ${deepShade(palette.primary, 0.86)} !important; }`

  const businessName = truncateText(slotValue(props, 'businessName'), MAX_NAME_LENGTH)
  const headline = truncateText(slotText(props, 'headline', ['offer', 'businessName']), MAX_MESSAGE_LENGTH)
  const offer = truncateText(slotValue(props, 'offer'), MAX_MESSAGE_LENGTH)
  const cta = slotValue(props, 'cta')
  const contact = slotValue(props, 'website') || slotValue(props, 'phone')
  const closing = truncateText([cta, contact].filter(Boolean).join(' — '), MAX_MESSAGE_LENGTH)

  const author = businessName || 'Announcements'
  const avatarLabel = author.charAt(0).toUpperCase()
  const messages: CommunityChatMessage[] = [headline, offer, closing]
    .filter((text) => text.length > 0)
    .map((text) => ({
      authorName: author,
      avatarLabel,
      avatarColor: palette.accent,
      time: 'Today',
      text,
    }))

  return (
    <DesignStage designId="community-chat" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <CommunityChat
          workspaceName={author}
          channelName="announcements"
          messages={messages}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default CommunityChatDesign
