import * as React from 'react'
// Individual packages, not '@react-email/components': the umbrella also loads code-block -> prismjs, which crashes in a plain Node
// function (it needs a DOM `Element`). The email template needs none of that.
import { Body } from '@react-email/body'
import { Button } from '@react-email/button'
import { Container } from '@react-email/container'
import { Head } from '@react-email/head'
import { Hr } from '@react-email/hr'
import { Html } from '@react-email/html'
import { Img } from '@react-email/img'
import { Link } from '@react-email/link'
import { Preview } from '@react-email/preview'
import { Section } from '@react-email/section'
import { Text } from '@react-email/text'
import type { OutreachEmail } from './emailModel'

/**
 * The outreach email as a React Email template (Stage 9). React Email renders to table-based, inline-styled HTML that survives Gmail,
 * Outlook and Apple Mail. All text arrives as React children, so merge-field values and subtitles are ESCAPED, never interpreted.
 *
 * The hero is the personalized GIF: Outlook for Windows shows only its FIRST frame, so the first frame must stand on its own (the
 * thumbnail/GIF stage guarantees a real picture there) and the alt text says what it is when images are blocked.
 */
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const para: React.CSSProperties = { margin: '0 0 16px', fontSize: 16, lineHeight: '24px', color: '#1f2937', fontFamily: font }

export const OutreachEmailTemplate: React.FC<{ email: OutreachEmail }> = ({ email }) => {
  const width = email.hero?.width ?? 480
  const hero = email.hero
  const img = hero ? <Img src={hero.url} alt={hero.alt} width={width} style={{ display: 'block', width: '100%', maxWidth: width, height: 'auto', border: 0, borderRadius: 8 }} /> : null
  const link = hero?.href ?? email.videoUrl
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>{email.subject}</title>
      </Head>
      {email.preheader ? <Preview>{email.preheader}</Preview> : null}
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#f3f4f6', fontFamily: font }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 28px 8px' }}>
            {email.greeting ? <Text style={{ ...para, fontWeight: 600 }}>{email.greeting}</Text> : null}
            {email.body.map((p, i) => <Text key={i} style={para}>{p}</Text>)}
            {img ? <Section style={{ margin: '8px 0 20px' }}>{link ? <Link href={link} style={{ textDecoration: 'none' }}>{img}</Link> : img}</Section> : null}
            {email.cta ? (
              <Section style={{ margin: '4px 0 24px', textAlign: 'center' }}>
                <Button href={email.cta.url} style={{ backgroundColor: '#111827', color: '#ffffff', fontFamily: font, fontSize: 16, fontWeight: 600, textDecoration: 'none', padding: '12px 24px', borderRadius: 8, display: 'inline-block' }}>{email.cta.label}</Button>
              </Section>
            ) : null}
            {email.signoff ? <Text style={{ ...para, whiteSpace: 'pre-line' }}>{email.signoff}</Text> : null}
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '20px 0 12px' }} />
          <Text style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: '#6b7280', fontFamily: font, textAlign: 'center' }}>
            {[email.sender.name, email.sender.postalAddress].filter(Boolean).join(' · ')}
          </Text>
          <Text style={{ margin: '6px 0 0', fontSize: 12, lineHeight: '18px', color: '#6b7280', fontFamily: font, textAlign: 'center' }}>
            You are receiving this because someone at {email.sender.name || 'the sender'} thought it would be useful to you.{' '}
            {email.unsubscribeUrl ? <Link href={email.unsubscribeUrl} style={{ color: '#6b7280', textDecoration: 'underline' }}>Unsubscribe</Link> : null}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
