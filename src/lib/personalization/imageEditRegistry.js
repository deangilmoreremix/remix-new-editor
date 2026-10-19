/**
 * SmartVideo AI personalization image editing registry.
 *
 * Ported/adapted from OpenHiggsBolt PR #31 after its merge to main.
 * This module is intentionally framework-agnostic so the Personalize modal,
 * Vision analysis, Video Ready orchestration, and editor UI share one contract.
 */

const ALL_ASSET_KINDS = [
  'person', 'logo', 'product', 'service', 'completed_work', 'storefront', 'office',
  'branded_vehicle', 'team', 'brand', 'first_frame', 'last_frame', 'cta_graphic',
  'background_reference', 'saved_reference', 'general',
];

const op = (id, label, group, description, prompt, extra = {}) => ({
  id,
  label,
  group,
  description,
  prompt,
  supportsMask: true,
  applicableTo: ALL_ASSET_KINDS,
  ...extra,
});

export const IMAGE_EDIT_OPERATIONS = {
  video_ready: op('video_ready', 'Make Video Ready', 'smart', 'Automatically prepare the asset for its SmartVideo AI video role.', 'Prepare this business image for professional video use. Follow the asset recipe, preserve the real subject and branding, improve composition and usability, and do not invent unnecessary changes.', { precision: true }),
  remove_background: op('remove_background', 'Remove Background', 'background', 'Remove the current background and isolate the primary subject.', 'Remove the entire background and isolate the primary subject with clean natural edges. Preserve the subject, identity, product, logo, text, geometry, colors and proportions.', { precision: true, transparency: true }),
  replace_background: op('replace_background', 'Replace Background', 'background', 'Replace the scene behind the subject while preserving the subject.', 'Replace only the background with the requested environment. Preserve the primary subject, identity, product, logo, text, clothing, proportions and pose.', { precision: true }),
  generate_background: op('generate_background', 'AI Background', 'background', 'Create a new professional background appropriate to the business.', 'Create a polished professional background appropriate to this business and subject. Keep the primary subject unchanged and naturally integrated into the new scene.', { precision: true }),
  blur_background: op('blur_background', 'Blur Background', 'background', 'Create shallow depth of field behind the main subject.', 'Keep the main subject sharp and unchanged while applying a realistic professional background blur with natural depth of field.'),
  transparent_cutout: op('transparent_cutout', 'Transparent Cutout', 'background', 'Create a transparent overlay asset.', 'Isolate the primary subject and return it on a fully transparent background with clean anti-aliased edges and no added elements.', { precision: true, transparency: true }),
  remove_object: op('remove_object', 'Remove Object', 'object', 'Remove a selected or described object and reconstruct the area.', 'Remove only the selected or described object. Reconstruct the exposed area naturally and preserve everything else.', { precision: true }),
  replace_object: op('replace_object', 'Replace Object', 'object', 'Replace a selected object with another object.', 'Replace only the selected or described object with the requested replacement. Preserve the rest of the image, composition and business branding.', { precision: true, destructiveCreative: true }),
  add_object: op('add_object', 'Add Object', 'object', 'Add a new object while maintaining realistic perspective and lighting.', 'Add the requested object naturally into the scene with correct perspective, scale, shadows and lighting. Preserve all existing important business details.', { destructiveCreative: true }),
  cleanup: op('cleanup', 'Clean Up', 'smart', 'Remove small distractions and visual artifacts.', 'Remove minor clutter, distracting artifacts and accidental visual noise while preserving important people, products, logos, signage, architecture and brand elements.'),
  enhance: op('enhance', 'Enhance', 'smart', 'Improve professional quality without redesigning the image.', 'Improve lighting, exposure, white balance, clarity, edge detail and overall polish. Preserve subject identity, products, logos, text, geometry and composition.', { precision: true }),
  relight: op('relight', 'Relight', 'effects', 'Improve or change lighting while preserving content.', 'Relight the scene professionally with natural highlights, shadows and skin or product tones. Preserve all subjects, products, logos, text and geometry.', { precision: true }),
  color_correct: op('color_correct', 'Color Correct', 'effects', 'Correct color cast, white balance and tonal range.', 'Correct white balance, color cast, exposure and tonal range for a natural professional result without changing the content.'),
  sharpen: op('sharpen', 'Sharpen', 'effects', 'Improve perceived detail and edge clarity.', 'Improve detail and edge clarity while avoiding halos, oversharpening, identity changes or invented texture.'),
  denoise: op('denoise', 'Denoise', 'effects', 'Reduce compression artifacts and image noise.', 'Reduce visible noise, compression artifacts and grain while preserving real texture, facial features, text, logos and product details.'),
  restore: op('restore', 'Restore Image', 'effects', 'Repair an old, damaged or low-quality business image.', 'Restore this image by repairing damage and artifacts and improving clarity while preserving the original people, objects, branding and historical appearance.', { precision: true }),
  outpaint: op('outpaint', 'Generative Expand', 'transform', 'Extend the image beyond its current borders.', 'Extend the scene beyond the existing frame naturally. Keep the original image content unchanged and continue its environment, perspective, lighting and style.', { precision: true }),
  reframe: op('reframe', 'AI Reframe', 'transform', 'Recompose the image for a target format.', 'Reframe the image for the selected output format. Keep important subjects fully visible and use generative expansion rather than cutting off important people, products, logos or signage.', { precision: true }),
  perspective: op('perspective', 'Correct Perspective', 'transform', 'Correct keystone and perspective distortion.', 'Correct perspective and keystone distortion while preserving architecture, products, signage and proportions. Keep the result realistic.'),
  straighten_scene: op('straighten_scene', 'Straighten Scene', 'transform', 'Level horizons, walls and architectural lines.', 'Straighten the scene and correct tilted horizons or architectural lines without changing the subject or business details.'),
  remove_people: op('remove_people', 'Remove Background People', 'people', 'Remove incidental people while preserving the main subject.', 'Remove incidental background people only. Preserve the main subject, employees intentionally featured, products, business location and branding.', { precision: true }),
  portrait_enhance: op('portrait_enhance', 'Portrait Enhance', 'people', 'Improve a portrait while preserving identity.', 'Enhance the portrait professionally. Preserve the person’s identity, facial structure, age, skin tone, hair, clothing and expression. Improve only lighting, clarity and presentation.', { precision: true, applicableTo: ['person', 'team'] }),
  headshot_prep: op('headshot_prep', 'Headshot Prep', 'people', 'Prepare a professional business headshot.', 'Prepare a polished professional headshot while preserving exact identity. Improve lighting and framing, use a clean appropriate background, and keep appearance realistic.', { precision: true, applicableTo: ['person'] }),
  presenter_cutout: op('presenter_cutout', 'Presenter Cutout', 'people', 'Prepare a person as a transparent video presenter.', 'Isolate the person for use as a video presenter overlay. Preserve exact identity, hair, clothing and body proportions. Return a clean transparent background and natural edges.', { precision: true, transparency: true, applicableTo: ['person'] }),
  team_enhance: op('team_enhance', 'Team Photo Prep', 'people', 'Prepare a team image while preserving every person.', 'Enhance this team photo while preserving every person’s identity, position and clothing. Improve lighting, balance and professional presentation without adding or removing team members.', { precision: true, applicableTo: ['team'] }),
  product_isolate: op('product_isolate', 'Product Isolation', 'product', 'Isolate a product with exact geometry and packaging preserved.', 'Isolate the product on a transparent background. Preserve exact product geometry, packaging, label, logo, copy, colors and proportions.', { precision: true, transparency: true, applicableTo: ['product'] }),
  product_studio: op('product_studio', 'Studio Product Shot', 'product', 'Turn a source product photo into a polished studio presentation.', 'Create a premium studio product presentation. Preserve the exact product, packaging, logo, text and colors. Improve lighting and place it on a clean commercial studio background.', { precision: true, applicableTo: ['product'] }),
  product_lifestyle: op('product_lifestyle', 'Lifestyle Product Scene', 'product', 'Place the real product in a relevant lifestyle environment.', 'Place the exact product into a realistic business-relevant lifestyle scene. Preserve product geometry, packaging, branding, label text and colors.', { precision: true, destructiveCreative: true, applicableTo: ['product'] }),
  product_hero: op('product_hero', 'Product Hero', 'product', 'Create a dramatic product advertising composition.', 'Create a premium commercial hero image around the exact product. Preserve product geometry, packaging, label, logo and brand colors. Use professional lighting and composition.', { precision: true, applicableTo: ['product'] }),
  packaging_preserve: op('packaging_preserve', 'Protect Packaging', 'product', 'Improve a product image without altering packaging.', 'Improve the surrounding image while preserving packaging geometry, printed copy, logos, regulatory marks, colors and product proportions exactly as closely as possible.', { precision: true, applicableTo: ['product'] }),
  logo_cleanup: op('logo_cleanup', 'Logo Cleanup', 'brand', 'Clean surrounding pixels and prepare a logo for video.', 'Clean the existing logo asset without redesigning it. Preserve original logo geometry, typography, colors and proportions. Remove unwanted surrounding pixels and edge artifacts.', { precision: true, applicableTo: ['logo'] }),
  logo_transparent: op('logo_transparent', 'Transparent Logo', 'brand', 'Prepare the existing logo on transparency.', 'Preserve the existing logo exactly as closely as possible and remove only its surrounding background. Return a transparent PNG-style result with clean edges and safe padding.', { precision: true, transparency: true, applicableTo: ['logo'] }),
  logo_dark_preview: op('logo_dark_preview', 'Dark Background Preview', 'brand', 'Preview the logo on a dark field.', 'Place the existing logo unchanged on a clean dark neutral background for visibility testing. Do not redesign or recolor the logo.', { precision: true, applicableTo: ['logo'] }),
  logo_light_preview: op('logo_light_preview', 'Light Background Preview', 'brand', 'Preview the logo on a light field.', 'Place the existing logo unchanged on a clean light neutral background for visibility testing. Do not redesign or recolor the logo.', { precision: true, applicableTo: ['logo'] }),
  brand_color_treatment: op('brand_color_treatment', 'Brand Color Treatment', 'brand', 'Apply an on-brand color treatment without changing key assets.', 'Apply the requested brand-color treatment to the scene while preserving people, products, logos, text and important business details.', { precision: true }),
  preserve_brand: op('preserve_brand', 'Brand-Safe Enhance', 'brand', 'Enhance while prioritizing brand fidelity.', 'Enhance this image while strictly prioritizing preservation of logos, brand colors, typography, packaging, signage and recognizable visual identity.', { precision: true }),
  remove_text: op('remove_text', 'Remove Text', 'text', 'Remove selected or described text from the image.', 'Remove only the selected or described text and reconstruct the underlying area naturally. Preserve all other text, logos and scene details.', { precision: true }),
  replace_text: op('replace_text', 'Replace Text', 'text', 'Replace selected text while retaining layout and treatment.', 'Replace only the requested text with the supplied copy. Preserve surrounding layout, typography treatment, branding, composition and all other content.', { precision: true }),
  clean_signage: op('clean_signage', 'Clean Signage', 'text', 'Improve the presentation of existing business signage.', 'Improve clarity, perspective and presentation of the existing business signage while preserving its wording, logo, colors and physical design.', { precision: true, applicableTo: ['storefront', 'office', 'branded_vehicle', 'brand'] }),
  storefront_enhance: op('storefront_enhance', 'Storefront Enhance', 'scene', 'Prepare a business exterior as an establishing shot.', 'Enhance the business storefront as a professional establishing image. Correct lighting and perspective, reduce incidental clutter, and preserve signage, architecture and business identity.', { precision: true, applicableTo: ['storefront'] }),
  interior_enhance: op('interior_enhance', 'Interior Enhance', 'scene', 'Prepare an office/interior as a polished business environment.', 'Enhance this business interior professionally. Correct white balance, exposure and perspective and remove minor clutter while preserving the real room, furnishings and branding.', { applicableTo: ['office'] }),
  completed_work_enhance: op('completed_work_enhance', 'Completed Work Showcase', 'scene', 'Showcase finished work professionally.', 'Enhance this completed project as a professional portfolio image. Preserve the actual finished work and property while improving lighting, perspective, clarity and composition.', { applicableTo: ['completed_work'] }),
  before_after_prep: op('before_after_prep', 'Before / After Prep', 'scene', 'Prepare an image for a before-and-after presentation.', 'Prepare this image for a clean before-and-after comparison. Preserve the actual work and property, correct framing and perspective, and leave compositionally useful space for a label.', { applicableTo: ['completed_work', 'service'] }),
  service_ad_prep: op('service_ad_prep', 'Service Ad Prep', 'scene', 'Prepare a real service scene for advertising.', 'Prepare this real service image for a professional local-business advertisement. Preserve workers, equipment and service context; improve lighting and framing; remove minor distractions; and leave useful headline/CTA space.', { precision: true, applicableTo: ['service'] }),
  vehicle_enhance: op('vehicle_enhance', 'Branded Vehicle Enhance', 'scene', 'Polish a company vehicle while preserving its graphics.', 'Enhance the branded company vehicle. Preserve vehicle shape, wrap, logo, phone number, website, text and brand colors. Improve lighting, reflections and presentation.', { precision: true, applicableTo: ['branded_vehicle'] }),
  vehicle_cutout: op('vehicle_cutout', 'Vehicle Cutout', 'scene', 'Create a transparent branded vehicle overlay.', 'Isolate the company vehicle on a transparent background while preserving the exact vehicle, wrap, logo, text, phone number and brand colors.', { precision: true, transparency: true, applicableTo: ['branded_vehicle'] }),
  commercial_ad: op('commercial_ad', 'Commercial Ad Look', 'scene', 'Give the image polished commercial advertising treatment.', 'Create a polished commercial-advertising treatment while preserving the real people, products, business, logo and critical text. Improve composition, lighting and visual impact without misrepresenting the business.'),
  social_ad: op('social_ad', 'Social Ad Prep', 'video', 'Prepare the asset for social advertising.', 'Prepare this image for a high-performing social ad composition. Preserve the real business subject and branding, improve visual hierarchy, and leave safe space for headline and CTA overlays.'),
  opening_frame: op('opening_frame', 'Opening Frame Prep', 'video', 'Prepare a strong branded first frame.', 'Prepare this image as an attention-grabbing opening frame. Preserve the business subject and branding, establish clear focus, and leave safe space for headline and logo overlays.', { applicableTo: ['first_frame', 'general', 'brand', 'completed_work', 'storefront', 'product', 'person'] }),
  end_card: op('end_card', 'End Card Prep', 'video', 'Prepare a clean final video frame.', 'Prepare this image as a clean branded end card with balanced negative space for logo, CTA, phone, website and offer. Preserve existing brand assets.', { applicableTo: ['last_frame', 'cta_graphic', 'brand', 'general'] }),
  cta_prep: op('cta_prep', 'CTA Graphic Prep', 'video', 'Prepare an asset for a clear call-to-action.', 'Prepare this image as a clear call-to-action graphic. Preserve business branding and create strong visual hierarchy with safe space for CTA copy, phone and website.', { applicableTo: ['cta_graphic', 'last_frame', 'brand', 'general'] }),
  lower_third: op('lower_third', 'Lower Third Prep', 'video', 'Prepare an asset for a lower-third position.', 'Prepare this asset for lower-third video placement with transparent or clean surrounding space, strong readability and safe padding.', { transparency: true }),
  picture_in_picture: op('picture_in_picture', 'Picture-in-Picture Prep', 'video', 'Prepare an image for PIP placement.', 'Prepare this image for picture-in-picture placement. Keep the subject clear, simplify distractions, and provide balanced padding around the key content.'),
  logo_bug: op('logo_bug', 'Logo Bug Prep', 'video', 'Prepare a logo for corner placement.', 'Prepare the exact existing logo for small corner video placement. Preserve its geometry and colors, remove the background, add safe transparent padding and optimize legibility.', { precision: true, transparency: true, applicableTo: ['logo'] }),
  video_background: op('video_background', 'Video Background Prep', 'video', 'Prepare an image to sit behind foreground content.', 'Prepare this image as a video background. Preserve recognizable business context, reduce distracting high-frequency detail, and create compositionally useful space for foreground subjects and copy.', { applicableTo: ['background_reference', 'storefront', 'office', 'brand', 'general'] }),
  vertical_prep: op('vertical_prep', 'Vertical 9:16 Prep', 'video', 'Prepare for TikTok, Reels and Shorts.', 'Recompose this image for a vertical 9:16 frame. Keep important subjects and business details within safe areas and extend the scene rather than cropping important content.', { precision: true }),
  horizontal_prep: op('horizontal_prep', 'Horizontal 16:9 Prep', 'video', 'Prepare for widescreen video.', 'Recompose this image for a horizontal 16:9 frame. Keep important subjects and business details visible and extend the scene rather than cropping important content.', { precision: true }),
  square_prep: op('square_prep', 'Square 1:1 Prep', 'video', 'Prepare for square social placement.', 'Recompose this image for a square 1:1 frame while keeping the main subject and branding visible and balanced.', { precision: true }),
  safe_area: op('safe_area', 'Safe Area Prep', 'video', 'Create composition room for UI, captions and CTA overlays.', 'Recompose the image so the primary subject avoids common social-video UI and caption zones. Preserve all important content and create clean negative space where appropriate.'),
  add_shadow: op('add_shadow', 'Add Natural Shadow', 'effects', 'Add realistic grounding or separation.', 'Add a subtle natural shadow appropriate to the subject and scene without changing the subject itself.'),
  add_outline: op('add_outline', 'Add Outline', 'effects', 'Create a clean subject outline for overlay use.', 'Add a clean professional outline around the isolated primary subject while keeping the subject unchanged.'),
  add_glow: op('add_glow', 'Add Glow', 'effects', 'Add restrained glow/separation for promotional graphics.', 'Add a tasteful restrained glow around the primary subject for separation while preserving the subject and branding.'),
  creative_style: op('creative_style', 'Creative Style', 'effects', 'Apply a requested visual style.', 'Apply the requested visual style while preserving recognizable subjects, products, logos, key text and brand identity.', { destructiveCreative: true }),
  change_environment: op('change_environment', 'Change Environment', 'scene', 'Move the subject into another environment.', 'Move the primary subject into the requested environment while preserving the subject identity, product, clothing, logos and proportions.', { precision: true, destructiveCreative: true }),
  change_time_of_day: op('change_time_of_day', 'Change Time of Day', 'scene', 'Change scene lighting/time while preserving the location.', 'Change the scene to the requested time of day while preserving the location, people, products, signage and business identity.', { destructiveCreative: true }),
  change_weather: op('change_weather', 'Change Weather', 'scene', 'Change weather conditions while preserving the business scene.', 'Change the weather to the requested condition while preserving the location, people, products, vehicles, signage and business identity.', { destructiveCreative: true }),
  change_clothing: op('change_clothing', 'Change Clothing', 'people', 'Change clothing only while preserving identity and pose.', 'Change only the requested clothing. Preserve the person’s identity, face, hair, pose, body proportions, expression and surrounding scene.', { precision: true, destructiveCreative: true, applicableTo: ['person'] }),
  custom: op('custom', 'Ask SmartVideo AI', 'smart', 'Describe any image edit in natural language.', 'Follow the user’s requested edit precisely. Preserve everything not explicitly requested to change.', { precision: true }),
};

const recipe = (kind, label, outputRole, recommended, makeVideoReadySteps, preserve, extra = {}) => ({
  kind,
  label,
  description: `SmartVideo AI editing recipe for ${label.toLowerCase()}.`,
  outputRole,
  transparencyRecommended: false,
  precisionRecommended: false,
  primaryAction: 'video_ready',
  recommended,
  makeVideoReadySteps,
  preserve,
  ...extra,
});

export const ASSET_RECIPES = {
  person: recipe('person', 'Person / Presenter', 'Presenter Overlay', ['presenter_cutout', 'portrait_enhance', 'headshot_prep', 'vertical_prep', 'relight'], ['portrait_enhance', 'presenter_cutout', 'safe_area'], ['face', 'identity', 'hair', 'skin tone', 'clothing', 'body proportions'], { transparencyRecommended: true, precisionRecommended: true }),
  logo: recipe('logo', 'Logo', 'Logo Overlay', ['logo_transparent', 'logo_cleanup', 'logo_bug', 'logo_dark_preview', 'logo_light_preview'], ['logo_cleanup', 'logo_transparent', 'logo_bug'], ['logo geometry', 'typography', 'brand colors', 'proportions'], { transparencyRecommended: true, precisionRecommended: true }),
  product: recipe('product', 'Product', 'Product Overlay', ['product_isolate', 'product_studio', 'product_hero', 'product_lifestyle', 'packaging_preserve'], ['enhance', 'product_isolate', 'safe_area'], ['product geometry', 'packaging', 'label text', 'logo', 'brand colors'], { transparencyRecommended: true, precisionRecommended: true }),
  service: recipe('service', 'Service', 'Service Marketing Asset', ['service_ad_prep', 'enhance', 'cleanup', 'social_ad', 'before_after_prep'], ['service_ad_prep', 'safe_area'], ['workers', 'tools', 'equipment', 'real service context'], { precisionRecommended: true }),
  completed_work: recipe('completed_work', 'Completed Work', 'Project Showcase Asset', ['completed_work_enhance', 'before_after_prep', 'perspective', 'social_ad', 'vertical_prep'], ['completed_work_enhance', 'perspective', 'safe_area'], ['actual finished work', 'property', 'materials', 'architectural details']),
  storefront: recipe('storefront', 'Storefront', 'Business Establishing Asset', ['storefront_enhance', 'clean_signage', 'perspective', 'remove_people', 'vertical_prep'], ['storefront_enhance', 'perspective', 'safe_area'], ['signage', 'architecture', 'logo', 'business identity'], { precisionRecommended: true }),
  office: recipe('office', 'Office / Interior', 'Business Interior Asset', ['interior_enhance', 'perspective', 'cleanup', 'video_background', 'vertical_prep'], ['interior_enhance', 'perspective', 'safe_area'], ['real room', 'furnishings', 'signage', 'brand elements']),
  branded_vehicle: recipe('branded_vehicle', 'Branded Vehicle', 'Branded Vehicle Asset', ['vehicle_enhance', 'vehicle_cutout', 'commercial_ad', 'clean_signage', 'social_ad'], ['vehicle_enhance', 'vehicle_cutout', 'safe_area'], ['vehicle shape', 'wrap', 'logo', 'phone', 'website', 'brand colors'], { transparencyRecommended: true, precisionRecommended: true }),
  team: recipe('team', 'Team', 'Team / About Us Asset', ['team_enhance', 'remove_background', 'social_ad', 'vertical_prep', 'relight'], ['team_enhance', 'safe_area'], ['every person', 'identity', 'clothing', 'team composition'], { precisionRecommended: true }),
  brand: recipe('brand', 'Brand Image', 'Brand Marketing Asset', ['preserve_brand', 'enhance', 'brand_color_treatment', 'social_ad', 'reframe'], ['preserve_brand', 'safe_area'], ['logos', 'brand colors', 'typography', 'recognizable brand identity'], { precisionRecommended: true }),
  first_frame: recipe('first_frame', 'First Frame', 'Opening Frame', ['opening_frame', 'safe_area', 'vertical_prep', 'horizontal_prep', 'enhance'], ['opening_frame', 'safe_area'], ['primary subject', 'logo', 'brand identity'], { precisionRecommended: true }),
  last_frame: recipe('last_frame', 'Last Frame', 'End Card', ['end_card', 'cta_prep', 'safe_area', 'logo_bug', 'brand_color_treatment'], ['end_card', 'safe_area'], ['logo', 'brand colors', 'business details'], { precisionRecommended: true }),
  cta_graphic: recipe('cta_graphic', 'CTA Graphic', 'CTA Overlay', ['cta_prep', 'lower_third', 'logo_bug', 'transparent_cutout', 'safe_area'], ['cta_prep', 'safe_area'], ['CTA wording', 'phone', 'website', 'logo', 'brand colors'], { transparencyRecommended: true, precisionRecommended: true }),
  background_reference: recipe('background_reference', 'Background Reference', 'Video Background', ['video_background', 'cleanup', 'blur_background', 'reframe', 'safe_area'], ['video_background', 'safe_area'], ['location identity', 'brand context']),
  saved_reference: recipe('saved_reference', 'Saved Reference', 'Reference Asset', ['enhance', 'reframe', 'cleanup', 'preserve_brand'], ['enhance', 'safe_area'], ['important subject', 'business identity']),
  general: recipe('general', 'Business Image', 'Video Asset', ['enhance', 'cleanup', 'reframe', 'social_ad', 'commercial_ad'], ['enhance', 'safe_area'], ['important subject', 'business identity']),
};

function roleToEditorAssetKind(role) {
  if (!role) return null;
  if (role === 'presenter_identity' || role === 'face_identity' || role === 'character_identity') return 'person';
  if (role === 'logo') return 'logo';
  if (role === 'product_reference') return 'product';
  if (role === 'first_frame') return 'first_frame';
  if (role === 'last_frame') return 'last_frame';
  if (role === 'cta_graphic') return 'cta_graphic';
  if (role === 'background_reference') return 'background_reference';
  if (role === 'saved_reference') return 'saved_reference';
  if (role === 'brand_reference') return 'brand';
  return null;
}

export function resolveEditorAssetKind(category, role) {
  if (category && category !== 'irrelevant') return category;
  return roleToEditorAssetKind(role) || 'general';
}

export function resolveEditorRecipeKind(category, role) {
  if (['first_frame', 'last_frame', 'cta_graphic', 'background_reference', 'saved_reference'].includes(role)) {
    return roleToEditorAssetKind(role) || 'general';
  }
  return resolveEditorAssetKind(category, role);
}

export function getOperation(id) {
  return IMAGE_EDIT_OPERATIONS[id] || null;
}

export function getSourceAssetRecipe(category, role) {
  return ASSET_RECIPES[resolveEditorAssetKind(category, role)];
}

export function getAssetRecipe(category, role) {
  return ASSET_RECIPES[resolveEditorRecipeKind(category, role)];
}

export function getOperationsForAsset(kind) {
  return Object.values(IMAGE_EDIT_OPERATIONS).filter((operation) => (
    !operation.applicableTo || operation.applicableTo.includes(kind)
  ));
}

export function operationGroupsForAsset(kind) {
  const groups = new Map();
  for (const operation of getOperationsForAsset(kind)) {
    if (operation.id === 'video_ready' || operation.id === 'custom') continue;
    const existing = groups.get(operation.group) || [];
    existing.push(operation);
    groups.set(operation.group, existing);
  }
  return groups;
}

export const EDITOR_ASSET_KINDS = Object.freeze([...ALL_ASSET_KINDS]);
export const EDITOR_OPERATION_GROUPS = Object.freeze([
  'smart', 'background', 'subject', 'people', 'product', 'brand',
  'object', 'text', 'scene', 'video', 'effects', 'transform',
]);
