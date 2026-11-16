// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import EmailLinkPanel from '../EmailLinkPanel'
import { mergeTagLink, mergeTagFor, leadLinks, leadLinksCsv, recipientIdTagFor, tokensInText, isUnreplacedMergeTag, EMAIL_PROVIDERS } from '../emailMergeLink'

const BASE = 'https://watch.example/v/abc'

describe('emailMergeLink', () => {
  it('builds provider tags and skips image tokens', () => {
    expect(mergeTagLink(BASE, ['firstName', 'email'], 'mailchimp', { includePrivate: true }).link).toBe(`${BASE}?firstName=*|FNAME|*&email=*|EMAIL|*`)
    expect(mergeTagLink(BASE, ['firstName'], 'klaviyo').link).toBe(`${BASE}?firstName={{ first_name }}`)
    const r = mergeTagLink(`${BASE}?x=1`, ['firstName', 'logoUrl', 'painPoint'], 'custom', { preload: false })
    expect(r.skipped).toEqual(['logoUrl'])
    expect(r.link).toBe(`${BASE}?x=1&preload=none&firstName={{firstName}}&painPoint={{painPoint}}`)
    expect(mergeTagLink(BASE, ['painPoint'], 'mailchimp').unmapped).toEqual(['painPoint'])
    expect(() => mergeTagLink(BASE, ['firstName'], 'nope')).toThrow()
    expect(EMAIL_PROVIDERS.length).toBeGreaterThan(10)
  })
  it('extracts tokens from text with aliases, defaults and de-duplication', () => {
    expect(tokensInText('Hi {{first name}}, {{d company "there"}} and {{firstName}} {{up title}}')).toEqual(['firstName', 'company', 'title'])
    expect(tokensInText('')).toEqual([])
  })
  it('recognises unreplaced tags only', () => {
    expect(isUnreplacedMergeTag('*|FNAME|*')).toBe(true)
    expect(isUnreplacedMergeTag('Ann')).toBe(false)
  })
})

describe('EmailLinkPanel', () => {
  beforeEach(() => { cleanup(); try { window.localStorage.clear() } catch { /* ignore */ } })

  it('explains how to get merge tags when the prompt has no tokens', () => {
    render(<EmailLinkPanel tokens={[]} />)
    expect(screen.getByTestId('pz-email-empty')).toBeTruthy()
  })
  it('needs a valid https link, then shows the provider-specific link and copies it', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    render(<EmailLinkPanel tokens={['firstName', 'company']} />)
    expect(screen.queryByTestId('pz-email-link')).toBeNull()
    fireEvent.change(screen.getByTestId('pz-email-base'), { target: { value: 'not a url' } })
    expect(screen.queryByTestId('pz-email-link')).toBeNull()
    fireEvent.change(screen.getByTestId('pz-email-base'), { target: { value: BASE } })
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?c=*|UNIQID|*&firstName=*|FNAME|*&company=*|COMPANY|*`)
    fireEvent.change(screen.getByTestId('pz-email-provider'), { target: { value: 'klaviyo' } })
    expect(screen.getByTestId('pz-email-link').textContent).toContain('firstName={{ first_name }}')
    fireEvent.click(screen.getByText('Copy link'))
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('{{ first_name }}'))
  })
  it('remembers the video link', () => {
    const { unmount } = render(<EmailLinkPanel tokens={['firstName']} />)
    fireEvent.change(screen.getByTestId('pz-email-base'), { target: { value: BASE } })
    unmount()
    render(<EmailLinkPanel tokens={['firstName']} />)
    expect((screen.getByTestId('pz-email-base') as HTMLInputElement).value).toBe(BASE)
  })
})

describe('per-provider tags (snapshot of the verified catalogue)', () => {
  const expected: Record<string, [string, string]> = {
    mailchimp: ['*|FNAME|*', '*|COMPANY|*'],            // company is not a default Mailchimp field -> custom
    activecampaign: ['%FIRSTNAME%', '%ORGNAME%'],
    klaviyo: ['{{ first_name }}', '{{ person.organization }}'],
    hubspot: ['{{contact.firstname}}', '{{contact.company}}'],
    constantcontact: ['[[FirstName]]', '[[CompanyName]]'],
    brevo: ['{{ contact.FIRSTNAME }}', '{{ contact.COMPANY }}'],
    mailerlite: ['{$name}', '{$company}'],
    kit: ['{{ subscriber.first_name }}', '{{ subscriber.company }}'],
    aweber: ['{{ subscriber.first_name }}', "{{ subscriber.custom_field['company'] }}"],
    drip: ['{{ subscriber.first_name }}', '{{ subscriber.company }}'],
    zoho: ['$[FNAME]$', '$[UD:COMPANY]$'],
    getresponse: ['[[firstname]]', '[[company]]'],
    campaignmonitor: ['[firstname,fallback=]', '[company,fallback=]'],
    salesforcemc: ['%%FirstName%%', '%%company%%'],
    custom: ['{{firstName}}', '{{company}}'],
  }
  it('covers every provider', () => {
    expect(Object.keys(expected).sort()).toEqual(EMAIL_PROVIDERS.map((p) => p.key).sort())
  })
  Object.entries(expected).forEach(([key, [first, company]]) => {
    it(`${key}: first name and company tags`, () => {
      const p = EMAIL_PROVIDERS.find((x) => x.key === key)!
      expect(mergeTagFor(p, 'firstName').tag).toBe(first)
      expect(mergeTagFor(p, 'company').tag).toBe(company)
    })
  })
  it('only maps built-in fields it can stand behind', () => {
    const mc = EMAIL_PROVIDERS.find((p) => p.key === 'mailchimp')!
    expect(mergeTagFor(mc, 'company').mapped).toBe(false)
    expect(mergeTagFor(mc, 'fullName').mapped).toBe(false)
    expect(mergeTagFor(EMAIL_PROVIDERS.find((p) => p.key === 'salesforcemc')!, 'email').tag).toBe('%%emailaddr%%')
  })
})

describe('per-lead links and CSV', () => {
  beforeEach(() => { cleanup(); try { window.localStorage.clear() } catch { /* ignore */ } })
  const leads = [
    { id: '1', business: { name: 'Acme, Inc.', email: 'hi@acme.test', city: 'Austin' } },
    { id: '2', business: { name: 'Bob "Best" Plumbing', city: '' } },
  ]
  it('builds one link per lead from the values it has, skipping image tokens', () => {
    const rows = leadLinks(BASE, ['company', 'email', 'location', 'firstName', 'logoUrl'], leads)
    expect(rows[0].link).toBe(`${BASE}?company=Acme%2C+Inc.&location=Austin`) // email stays out of the URL by default
    expect(rows[1].link).toBe(`${BASE}?company=Bob+%22Best%22+Plumbing`)
    expect(rows.map((r) => r.name)).toEqual(['Acme, Inc.', 'Bob "Best" Plumbing'])
  })
  it('quotes CSV cells', () => {
    const csv = leadLinksCsv(leadLinks(BASE, ['company'], leads))
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Name,Email,Company,Link')
    expect(lines[1].startsWith('"Acme, Inc.",hi@acme.test,"Acme, Inc.",')).toBe(true)
    expect(lines[2].startsWith('"Bob ""Best"" Plumbing",,')).toBe(true)
  })
  it('the panel loads saved leads on demand, lists them and offers the CSV', async () => {
    window.localStorage.setItem('pz-email-link-base', BASE)
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ leads }) }))
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    render(<EmailLinkPanel tokens={['company']} />)
    fireEvent.click(screen.getByText('Load saved leads'))
    await screen.findByText(/Download CSV \(2\)/)
    expect(fetchMock).toHaveBeenCalledWith('/api/personalization/leads', { credentials: 'same-origin' })
    expect(screen.getByText(/Acme, Inc\./)).toBeTruthy()
    vi.unstubAllGlobals()
  })
  it('shows a sign-in message on 401', async () => {
    window.localStorage.setItem('pz-email-link-base', BASE)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    render(<EmailLinkPanel tokens={['company']} />)
    fireEvent.click(screen.getByText('Load saved leads'))
    await screen.findByText(/Sign in to use your saved leads/)
    vi.unstubAllGlobals()
  })
})

// Golden table. KEEP IN SYNC with the twin file: remix-new-editor/src/lib/editor/personalize/emailMergeLink.js
// <-> OpenHiggsBolt/src/shared/personalization/emailMergeLink.ts. If you change a provider tag in one repo, change it in the other.
describe('golden provider tags (cross-repo drift guard)', () => {
  const golden: Record<string, string> = {
    mailchimp: '*|FNAME|*|*|LNAME|*|*|EMAIL|*',
    activecampaign: '%FIRSTNAME%|%LASTNAME%|%EMAIL%',
    klaviyo: '{{ first_name }}|{{ last_name }}|{{ email }}',
    hubspot: '{{contact.firstname}}|{{contact.lastname}}|{{contact.email}}',
    constantcontact: '[[FirstName]]|[[LastName]]|[[EmailAddress]]',
    brevo: '{{ contact.FIRSTNAME }}|{{ contact.LASTNAME }}|{{ contact.EMAIL }}',
    mailerlite: '{$name}|{$last_name}|{$email}',
    kit: '{{ subscriber.first_name }}|{{ subscriber.last_name }}|{{ subscriber.email_address }}',
    aweber: '{{ subscriber.first_name }}|{{ subscriber.last_name }}|{{ subscriber.email }}',
    drip: '{{ subscriber.first_name }}|{{ subscriber.last_name }}|{{ subscriber.email }}',
    zoho: '$[FNAME]$|$[LNAME]$|$[UD:CONTACT_EMAIL]$',
    getresponse: '[[firstname]]|[[lastname]]|[[email]]',
    campaignmonitor: '[firstname,fallback=]|[lastname,fallback=]|[email]',
    salesforcemc: '%%FirstName%%|%%LastName%%|%%emailaddr%%',
    custom: '{{firstName}}|{{lastName}}|{{email}}',
  }
  it('matches the shared table', () => {
    const actual = Object.fromEntries(EMAIL_PROVIDERS.map((p) => [p.key, ['firstName', 'lastName', 'email'].map((t) => mergeTagFor(p, t).tag).join('|')]))
    expect(actual).toEqual(golden)
  })
})

describe('custom (user-defined) provider', () => {
  beforeEach(() => { cleanup(); try { window.localStorage.clear() } catch { /* ignore */ } window.localStorage.setItem('pz-email-link-base', BASE) })

  const pickCustom = () => fireEvent.change(screen.getByTestId('pz-email-provider'), { target: { value: 'custom' } })

  it('uses the user\'s own wrapper', () => {
    render(<EmailLinkPanel tokens={['firstName']} />)
    pickCustom()
    fireEvent.change(screen.getByTestId('pz-email-custom-open'), { target: { value: '<<' } })
    fireEvent.change(screen.getByTestId('pz-email-custom-close'), { target: { value: '>>' } })
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?firstName=<<firstName>>`)
  })
  it('applies per-token field names and ignores malformed lines', () => {
    render(<EmailLinkPanel tokens={['firstName', 'company']} />)
    pickCustom()
    fireEvent.change(screen.getByTestId('pz-email-custom-fields'), { target: { value: 'firstName=FirstName\nnonsense\n=x\ncompany=Org' } })
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?firstName={{FirstName}}&company={{Org}}`)
  })
  it('falls back to {{ }} when the wrapper is emptied', () => {
    render(<EmailLinkPanel tokens={['firstName']} />)
    pickCustom()
    fireEvent.change(screen.getByTestId('pz-email-custom-open'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('pz-email-custom-close'), { target: { value: '  ' } })
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?firstName={{firstName}}`)
  })
  it('remembers the custom provider across remounts', () => {
    const { unmount } = render(<EmailLinkPanel tokens={['firstName']} />)
    pickCustom()
    fireEvent.change(screen.getByTestId('pz-email-custom-open'), { target: { value: '[[' } })
    fireEvent.change(screen.getByTestId('pz-email-custom-close'), { target: { value: ']]' } })
    unmount()
    render(<EmailLinkPanel tokens={['firstName']} />)
    pickCustom()
    expect((screen.getByTestId('pz-email-custom-open') as HTMLInputElement).value).toBe('[[')
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?firstName=[[firstName]]`)
  })
  it('shows the editor only for Custom, and shows no vendor "create a field" advice for it', () => {
    render(<EmailLinkPanel tokens={['painPoint']} />)
    expect(screen.queryByTestId('pz-email-custom')).toBeNull()
    pickCustom()
    expect(screen.getByTestId('pz-email-custom')).toBeTruthy()
    expect(screen.queryByText(/Create a custom field/)).toBeNull()
  })
})

describe('campaign options, preflight, preview and email snippet', () => {
  beforeEach(() => { cleanup(); try { window.localStorage.clear() } catch { /* ignore */ } window.localStorage.setItem('pz-email-link-base', BASE) })

  it('Mailchimp adds its recipient id; other providers ask for one', () => {
    render(<EmailLinkPanel tokens={['firstName']} />)
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?c=*|UNIQID|*&firstName=*|FNAME|*`)
    expect(screen.getByTestId('pz-email-preflight').textContent).toContain('Views will show per recipient')
    fireEvent.change(screen.getByTestId('pz-email-provider'), { target: { value: 'klaviyo' } })
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?firstName={{ first_name }}`)
    expect(screen.getByTestId('pz-email-preflight').textContent).toContain('No recipient id')
  })
  it('lets the sender set their own recipient id tag, or clear it', () => {
    render(<EmailLinkPanel tokens={['firstName']} />)
    fireEvent.change(screen.getByTestId('pz-email-recipient'), { target: { value: '{{ person.id }}' } })
    expect(screen.getByTestId('pz-email-link').textContent).toContain('c={{ person.id }}')
    fireEvent.change(screen.getByTestId('pz-email-recipient'), { target: { value: '' } })
    expect(screen.getByTestId('pz-email-link').textContent).not.toContain('c=')
    expect(screen.getByTestId('pz-email-preflight').textContent).toContain('No recipient id')
  })
  it('adds UTM tags and keeps email/phone out of the URL unless asked', () => {
    render(<EmailLinkPanel tokens={['firstName', 'email']} />)
    expect(screen.getByTestId('pz-email-link').textContent).not.toContain('email=')
    expect(screen.getByTestId('pz-email-preflight').textContent).toContain('Left out of the link')
    fireEvent.change(screen.getByTestId('pz-email-utm'), { target: { value: 'Spring sale' } })
    expect(screen.getByTestId('pz-email-link').textContent).toContain('utm_campaign=Spring%20sale')
    fireEvent.click(screen.getByTestId('pz-email-private'))
    expect(screen.getByTestId('pz-email-link').textContent).toContain('email=*|EMAIL|*')
  })
  it('warns about tokens with no fallback, and gives a preview link with sample values', () => {
    render(<EmailLinkPanel tokens={['firstName', 'company']} noDefaults={['firstName']} />)
    expect(screen.getByTestId('pz-email-preflight').textContent).toContain('No fallback for firstName')
    expect((screen.getByTestId('pz-email-preview') as HTMLAnchorElement).href).toBe(`${BASE}?firstName=Alex&company=Acme+Co`)
  })
  it('builds a copyable email snippet: button by default, poster image when given', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    render(<EmailLinkPanel tokens={['firstName']} />)
    expect(screen.getByTestId('pz-email-snippet-code').textContent).toContain('Watch your video</a>')
    fireEvent.change(screen.getByTestId('pz-email-poster'), { target: { value: 'https://img.example/p.png' } })
    expect(screen.getByTestId('pz-email-snippet-code').textContent).toContain('<img src="https://img.example/p.png"')
    fireEvent.click(screen.getByText('Copy snippet'))
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('href="https://watch.example/v/abc?c=*|UNIQID|*'))
  })
  it('lead links also keep email out of the URL by default', () => {
    const rows = leadLinks(BASE, ['company', 'email'], [{ business: { name: 'Acme', email: 'hi@acme.test' } }])
    expect(rows[0].link).toBe(`${BASE}?company=Acme`)
    expect(rows[0].email).toBe('hi@acme.test')
    expect(leadLinks(BASE, ['email'], [{ business: { name: 'Acme', email: 'hi@acme.test' } }], { includePrivate: true })[0].link).toBe(`${BASE}?email=hi%40acme.test`)
  })
})

describe('verified-from-docs details (provider research)', () => {
  const tag = (key: string, token: string) => mergeTagFor(EMAIL_PROVIDERS.find((p) => p.key === key)!, token)
  it('Kit custom fields are snake_case; Drip too; AWeber uses custom_field[...]', () => {
    expect(tag('kit', 'painPoint').tag).toBe('{{ subscriber.pain_point }}')
    expect(tag('drip', 'painPoint').tag).toBe('{{ subscriber.pain_point }}')
    expect(tag('aweber', 'painPoint').tag).toBe("{{ subscriber.custom_field['painPoint'] }}")
  })
  it('Constant Contact has the documented standard tags and Custom.<field> for the rest', () => {
    expect(tag('constantcontact', 'title').tag).toBe('[[JobTitle]]')
    expect(tag('constantcontact', 'location').tag).toBe('[[City]]')
    expect(tag('constantcontact', 'painPoint').tag).toBe('[[Custom.painPoint]]')
  })
  it('Klaviyo person.* fields, Campaign Monitor [email], Zoho custom tags', () => {
    expect(tag('klaviyo', 'title').tag).toBe('{{ person.title }}')
    expect(tag('campaignmonitor', 'email')).toEqual({ tag: '[email]', mapped: true })
    expect(tag('zoho', 'painPoint')).toEqual({ tag: '$[UD:PAINPOINT]$', mapped: false })
  })
  it('recipient ids: AWeber subscriber.id, Salesforce subscriber key, Mailchimp flagged unverified', () => {
    const by = (k: string) => EMAIL_PROVIDERS.find((p) => p.key === k)!
    expect(recipientIdTagFor(by('aweber'))).toBe('{{ subscriber.id }}')
    expect(recipientIdTagFor(by('salesforcemc'))).toBe('%%_subscriberkey%%')
    expect(recipientIdTagFor(by('klaviyo'))).toBe('')
    expect(by('mailchimp').recipientUnverified).toBe(true)
  })
})

