// src/lib/personalization/brandFromProfile.js
//
// The brand fields the Personalize window's composition draws from (business
// name, headline, offer, call to action, images), taken from a timeline contact
// profile with the same token rules as {{tokens}}, so a design or layout check
// shows what the contact's video shows. Pure: tokenSchema only.
import { resolveToken } from '../../components/personalize/tokenSchema.js';

const text = (profile, key) => String(resolveToken(profile, key) ?? '').trim();

/** The same brand fields `buildPreviewInput` derives, from a timeline contact profile. */
export function brandFromProfile(profile) {
  const businessName = text(profile, 'businessName') || text(profile, 'company') || text(profile, 'fullName');
  const website = text(profile, 'website');
  const phone = text(profile, 'businessPhone');
  return {
    businessName,
    headline: text(profile, 'ctaHeadline') || text(profile, 'productService') || businessName,
    offer: text(profile, 'offer'),
    cta: text(profile, 'callToAction') || (website ? `Visit ${website}` : phone ? `Call ${phone}` : ''),
    phone,
    website,
    logoUrl: text(profile, 'logoUrl') || null,
    productUrl: text(profile, 'productImageUrl') || null,
    serviceUrl: text(profile, 'brandImageUrl') || text(profile, 'productImageUrl') || null,
  };
}

