import { describe, it, expect, vi, beforeEach } from 'vitest';

const templateEnginePath = '../../src/lib/templateEngine.js';

describe('templateEngine.js', () => {
  let engine;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import(templateEnginePath);
    engine = mod;
  });

  describe('exported constants', () => {
    it('FILM_TYPES has all expected film type keys', () => {
      expect(engine.FILM_TYPES).toBeDefined();
      expect(Object.keys(engine.FILM_TYPES)).toHaveLength(8);
      expect(engine.FILM_TYPES.DRAMATIC_TRAILER).toBe('dramatic-trailer');
      expect(engine.FILM_TYPES.FOUNDER_STORY_FILM).toBe('founder-story-film');
      expect(engine.FILM_TYPES.TESTIMONIAL_FILM).toBe('testimonial-film');
      expect(engine.FILM_TYPES.CASE_STUDY_FILM).toBe('case-study-film');
      expect(engine.FILM_TYPES.PROMO_FILM).toBe('promo-film');
      expect(engine.FILM_TYPES.CINEMATIC_COMMERCIAL).toBe('cinematic-commercial');
      expect(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM).toBe('documentary-style-film');
      expect(engine.FILM_TYPES.CINEMATIC_SHORT_FILM).toBe('cinematic-short-film');
    });

    it('NICHE_TYPES has all expected niche keys', () => {
      expect(engine.NICHE_TYPES).toBeDefined();
      expect(Object.keys(engine.NICHE_TYPES)).toHaveLength(17);
      expect(engine.NICHE_TYPES.RESTAURANT).toBe('restaurant');
      expect(engine.NICHE_TYPES.MED_SPA).toBe('med-spa');
      expect(engine.NICHE_TYPES.SALON).toBe('salon');
      expect(engine.NICHE_TYPES.BARBERSHOP).toBe('barbershop');
      expect(engine.NICHE_TYPES.FITNESS).toBe('fitness');
      expect(engine.NICHE_TYPES.REAL_ESTATE).toBe('real-estate');
      expect(engine.NICHE_TYPES.DENTAL).toBe('dental');
      expect(engine.NICHE_TYPES.CHIROPRACTIC).toBe('chiropractic');
      expect(engine.NICHE_TYPES.LEGAL).toBe('legal');
      expect(engine.NICHE_TYPES.AUTOMOTIVE).toBe('automotive');
      expect(engine.NICHE_TYPES.FASHION).toBe('fashion');
      expect(engine.NICHE_TYPES.EVENT).toBe('event');
      expect(engine.NICHE_TYPES.LUXURY_BRAND).toBe('luxury-brand');
      expect(engine.NICHE_TYPES.LOCAL_BUSINESS).toBe('local-business');
      expect(engine.NICHE_TYPES.SAAS).toBe('saas');
      expect(engine.NICHE_TYPES.AGENCY).toBe('agency');
      expect(engine.NICHE_TYPES.GENERAL).toBe('general-business');
    });

    it('CINEMATIC_STYLES has all expected style keys', () => {
      expect(engine.CINEMATIC_STYLES).toBeDefined();
      expect(Object.keys(engine.CINEMATIC_STYLES)).toHaveLength(8);
      expect(engine.CINEMATIC_STYLES.LUXURY).toBe('luxury');
      expect(engine.CINEMATIC_STYLES.DRAMATIC).toBe('dramatic');
      expect(engine.CINEMATIC_STYLES.DOCUMENTARY).toBe('documentary');
      expect(engine.CINEMATIC_STYLES.COMMERCIAL).toBe('commercial');
      expect(engine.CINEMATIC_STYLES.BOLD).toBe('bold');
      expect(engine.CINEMATIC_STYLES.MINIMAL).toBe('minimal');
      expect(engine.CINEMATIC_STYLES.WARM).toBe('warm');
      expect(engine.CINEMATIC_STYLES.COOL).toBe('cool');
    });

    it('CINEMATIC_STYLE_BUCKETS has entries for each style', () => {
      expect(engine.CINEMATIC_STYLE_BUCKETS).toBeDefined();
      const styleKeys = Object.values(engine.CINEMATIC_STYLES);
      for (const style of styleKeys) {
        expect(engine.CINEMATIC_STYLE_BUCKETS[style]).toBeDefined();
        expect(Array.isArray(engine.CINEMATIC_STYLE_BUCKETS[style])).toBe(true);
        expect(engine.CINEMATIC_STYLE_BUCKETS[style].length).toBeGreaterThan(0);
      }
    });

    it('CINEMATOGRAPHY has all expected sections with arrays', () => {
      expect(engine.CINEMATOGRAPHY).toBeDefined();
      expect(engine.CINEMATOGRAPHY.CAMERA_MOVEMENTS).toBeDefined();
      expect(engine.CINEMATOGRAPHY.FRAMING).toBeDefined();
      expect(engine.CINEMATOGRAPHY.LIGHTING).toBeDefined();
      expect(engine.CINEMATOGRAPHY.LENS_LOOK).toBeDefined();
      expect(engine.CINEMATOGRAPHY.PACING).toBeDefined();
      for (const key of Object.keys(engine.CINEMATOGRAPHY)) {
        expect(Array.isArray(engine.CINEMATOGRAPHY[key])).toBe(true);
        expect(engine.CINEMATOGRAPHY[key].length).toBeGreaterThan(0);
      }
    });

    it('STORY_BLUESPRINTS has entries for all film types', () => {
      expect(engine.STORY_BLUESPRINTS).toBeDefined();
      for (const filmType of Object.values(engine.FILM_TYPES)) {
        expect(engine.STORY_BLUESPRINTS[filmType]).toBeDefined();
        expect(Array.isArray(engine.STORY_BLUESPRINTS[filmType])).toBe(true);
        expect(engine.STORY_BLUESPRINTS[filmType].length).toBeGreaterThan(0);
      }
    });

    it('NICHE_TERMS has entries for all niche types', () => {
      expect(engine.NICHE_TERMS).toBeDefined();
      for (const niche of Object.values(engine.NICHE_TYPES)) {
        expect(engine.NICHE_TERMS[niche]).toBeDefined();
        expect(Array.isArray(engine.NICHE_TERMS[niche])).toBe(true);
        expect(engine.NICHE_TERMS[niche].length).toBeGreaterThan(0);
      }
    });

    it('OUTPUT_MODES has all expected keys', () => {
      expect(engine.OUTPUT_MODES).toBeDefined();
      expect(Object.keys(engine.OUTPUT_MODES)).toHaveLength(5);
      expect(engine.OUTPUT_MODES.MASTER_PROMPT).toBe('master_prompt');
      expect(engine.OUTPUT_MODES.SHOT_ENHANCED).toBe('shot_enhanced_prompt');
      expect(engine.OUTPUT_MODES.SCENE_PACK).toBe('scene_prompt_pack');
      expect(engine.OUTPUT_MODES.VOICEOVER).toBe('voiceover_direction');
      expect(engine.OUTPUT_MODES.NEGATIVE).toBe('negative_prompt');
    });

    it('OUTPUT_MODE_LABELS has labels for each OUTPUT_MODES value', () => {
      expect(engine.OUTPUT_MODE_LABELS).toBeDefined();
      for (const key of Object.keys(engine.OUTPUT_MODES)) {
        expect(engine.OUTPUT_MODE_LABELS[engine.OUTPUT_MODES[key]]).toBeDefined();
        expect(typeof engine.OUTPUT_MODE_LABELS[engine.OUTPUT_MODES[key]]).toBe('string');
      }
    });
  });

  describe('detectFilmType', () => {
    const makeInput = (overrides = {}) => ({
      rawIdea: '',
      templateType: '',
      objective: '',
      tone: '',
      ...overrides
    });

    it('returns DRAMATIC_TRAILER for trailer input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'Make a trailer for our product' })))
        .toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('returns DRAMATIC_TRAILER for dramatic input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'dramatic reveal' })))
        .toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('returns DRAMATIC_TRAILER for teaser input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'teaser video' })))
        .toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('returns FOUNDER_STORY_FILM for founder input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'founder journey' })))
        .toBe(engine.FILM_TYPES.FOUNDER_STORY_FILM);
    });

    it('returns FOUNDER_STORY_FILM for origin input', () => {
      expect(engine.detectFilmType(makeInput({ templateType: 'origin story' })))
        .toBe(engine.FILM_TYPES.FOUNDER_STORY_FILM);
    });

    it('returns FOUNDER_STORY_FILM for entrepreneur input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'entrepreneur spotlight' })))
        .toBe(engine.FILM_TYPES.FOUNDER_STORY_FILM);
    });

    it('returns TESTIMONIAL_FILM for testimonial input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'client testimonial' })))
        .toBe(engine.FILM_TYPES.TESTIMONIAL_FILM);
    });

    it('returns TESTIMONIAL_FILM for client success input', () => {
      expect(engine.detectFilmType(makeInput({ templateType: 'client success story' })))
        .toBe(engine.FILM_TYPES.TESTIMONIAL_FILM);
    });

    it('returns TESTIMONIAL_FILM for customer success input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'customer success' })))
        .toBe(engine.FILM_TYPES.TESTIMONIAL_FILM);
    });

    it('returns CASE_STUDY_FILM for case study input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'case study video' })))
        .toBe(engine.FILM_TYPES.CASE_STUDY_FILM);
    });

    it('returns CASE_STUDY_FILM for results input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'show results' })))
        .toBe(engine.FILM_TYPES.CASE_STUDY_FILM);
    });

    it('returns PROMO_FILM for promo input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'promo video' })))
        .toBe(engine.FILM_TYPES.PROMO_FILM);
    });

    it('returns PROMO_FILM for offer input', () => {
      expect(engine.detectFilmType(makeInput({ templateType: 'special offer' })))
        .toBe(engine.FILM_TYPES.PROMO_FILM);
    });

    it('returns PROMO_FILM for launch input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'product launch' })))
        .toBe(engine.FILM_TYPES.PROMO_FILM);
    });

    it('returns CINEMATIC_COMMERCIAL for commercial input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'commercial spot' })))
        .toBe(engine.FILM_TYPES.CINEMATIC_COMMERCIAL);
    });

    it('returns CINEMATIC_COMMERCIAL for ad input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'make an ad' })))
        .toBe(engine.FILM_TYPES.CINEMATIC_COMMERCIAL);
    });

    it('returns CINEMATIC_COMMERCIAL for advertisement input', () => {
      expect(engine.detectFilmType(makeInput({ templateType: 'advertisement' })))
        .toBe(engine.FILM_TYPES.CINEMATIC_COMMERCIAL);
    });

    it('returns DOCUMENTARY_STYLE_FILM for documentary input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'documentary style' })))
        .toBe(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM);
    });

    it('returns DOCUMENTARY_STYLE_FILM for authentic input', () => {
      expect(engine.detectFilmType(makeInput({ objective: 'authentic story' })))
        .toBe(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM);
    });

    it('returns DOCUMENTARY_STYLE_FILM for real story input', () => {
      expect(engine.detectFilmType(makeInput({ templateType: 'real story' })))
        .toBe(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM);
    });

    it('returns CINEMATIC_SHORT_FILM as default for unrecognized input', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'something random' })))
        .toBe(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
    });

    it('returns CINEMATIC_SHORT_FILM for empty input', () => {
      expect(engine.detectFilmType(makeInput({})))
        .toBe(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
    });

    it('is case-insensitive for trailer detection', () => {
      expect(engine.detectFilmType(makeInput({ rawIdea: 'TRAILER' })))
        .toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
      expect(engine.detectFilmType(makeInput({ rawIdea: 'Trailer' })))
        .toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });
  });

  describe('detectNiche', () => {
    const makeInput = (overrides = {}) => ({
      businessType: '',
      niche: '',
      productService: '',
      rawIdea: '',
      ...overrides
    });

    it('returns RESTAURANT for restaurant input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'restaurant' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
    });

    it('returns RESTAURANT for cafe input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'cafe' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
    });

    it('returns RESTAURANT for food input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'food service' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
    });

    it('returns RESTAURANT for chef input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'chef cooking' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
    });

    it('returns RESTAURANT for steakhouse input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'steakhouse' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
    });

    it('returns MED_SPA for med spa input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'med spa' })))
        .toBe(engine.NICHE_TYPES.MED_SPA);
    });

    it('returns MED_SPA for skincare input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'skincare' })))
        .toBe(engine.NICHE_TYPES.MED_SPA);
    });

    it('returns MED_SPA for beauty clinic input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'beauty clinic' })))
        .toBe(engine.NICHE_TYPES.MED_SPA);
    });

    it('returns MED_SPA for aesthetic input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'aesthetic treatments' })))
        .toBe(engine.NICHE_TYPES.MED_SPA);
    });

    it('returns SALON for salon input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'salon' })))
        .toBe(engine.NICHE_TYPES.SALON);
    });

    it('returns SALON for hair salon input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'hair salon' })))
        .toBe(engine.NICHE_TYPES.SALON);
    });

    it('returns SALON for stylist input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'stylist services' })))
        .toBe(engine.NICHE_TYPES.SALON);
    });

    it('returns BARBERSHOP for barber input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'barber' })))
        .toBe(engine.NICHE_TYPES.BARBERSHOP);
    });

    it('returns BARBERSHOP for barbershop input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'barbershop' })))
        .toBe(engine.NICHE_TYPES.BARBERSHOP);
    });

    it('returns FITNESS for gym input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'gym' })))
        .toBe(engine.NICHE_TYPES.FITNESS);
    });

    it('returns FITNESS for fitness input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'fitness' })))
        .toBe(engine.NICHE_TYPES.FITNESS);
    });

    it('returns FITNESS for trainer input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'personal trainer' })))
        .toBe(engine.NICHE_TYPES.FITNESS);
    });

    it('returns FITNESS for workout input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'workout plans' })))
        .toBe(engine.NICHE_TYPES.FITNESS);
    });

    it('returns REAL_ESTATE for property input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'property sales' })))
        .toBe(engine.NICHE_TYPES.REAL_ESTATE);
    });

    it('returns REAL_ESTATE for listing input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'home listing' })))
        .toBe(engine.NICHE_TYPES.REAL_ESTATE);
    });

    it('returns REAL_ESTATE for realtor input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'realtor services' })))
        .toBe(engine.NICHE_TYPES.REAL_ESTATE);
    });

    it('returns REAL_ESTATE for real estate input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'real estate video' })))
        .toBe(engine.NICHE_TYPES.REAL_ESTATE);
    });

    it('returns REAL_ESTATE for home input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'home staging' })))
        .toBe(engine.NICHE_TYPES.REAL_ESTATE);
    });

    it('returns DENTAL for dental input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'dental' })))
        .toBe(engine.NICHE_TYPES.DENTAL);
    });

    it('returns DENTAL for dentist input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'dentist office' })))
        .toBe(engine.NICHE_TYPES.DENTAL);
    });

    it('returns DENTAL for smile input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'smile makeover' })))
        .toBe(engine.NICHE_TYPES.DENTAL);
    });

    it('returns CHIROPRACTIC for chiro input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'chiro' })))
        .toBe(engine.NICHE_TYPES.CHIROPRACTIC);
    });

    it('returns CHIROPRACTIC for wellness clinic input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'wellness clinic' })))
        .toBe(engine.NICHE_TYPES.CHIROPRACTIC);
    });

    it('returns CHIROPRACTIC for adjustment input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'spinal adjustment' })))
        .toBe(engine.NICHE_TYPES.CHIROPRACTIC);
    });

    it('returns LEGAL for law input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'law firm' })))
        .toBe(engine.NICHE_TYPES.LEGAL);
    });

    it('returns LEGAL for attorney input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'attorney services' })))
        .toBe(engine.NICHE_TYPES.LEGAL);
    });

    it('returns LEGAL for lawyer input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'lawyer consultation' })))
        .toBe(engine.NICHE_TYPES.LEGAL);
    });

    it('returns LEGAL for legal input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'legal representation' })))
        .toBe(engine.NICHE_TYPES.LEGAL);
    });

    it('returns AUTOMOTIVE for auto input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'auto repair' })))
        .toBe(engine.NICHE_TYPES.AUTOMOTIVE);
    });

    it('returns AUTOMOTIVE for car input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'car sales' })))
        .toBe(engine.NICHE_TYPES.AUTOMOTIVE);
    });

    it('returns AUTOMOTIVE for vehicle input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'vehicle detailing' })))
        .toBe(engine.NICHE_TYPES.AUTOMOTIVE);
    });

    it('returns AUTOMOTIVE for dealership input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'dealership showcase' })))
        .toBe(engine.NICHE_TYPES.AUTOMOTIVE);
    });

    it('returns FASHION for fashion input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'fashion brand' })))
        .toBe(engine.NICHE_TYPES.FASHION);
    });

    it('returns FASHION for clothing input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'clothing store' })))
        .toBe(engine.NICHE_TYPES.FASHION);
    });

    it('returns FASHION for apparel input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'apparel design' })))
        .toBe(engine.NICHE_TYPES.FASHION);
    });

    it('returns FASHION for designer input', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'designer collection' })))
        .toBe(engine.NICHE_TYPES.FASHION);
    });

    it('returns EVENT for event input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'event planning' })))
        .toBe(engine.NICHE_TYPES.EVENT);
    });

    it('returns EVENT for conference input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'conference organizer' })))
        .toBe(engine.NICHE_TYPES.EVENT);
    });

    it('returns EVENT for launch event', () => {
      expect(engine.detectNiche(makeInput({ rawIdea: 'product launch event' })))
        .toBe(engine.NICHE_TYPES.EVENT);
    });

    it('returns LUXURY_BRAND for luxury input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'luxury brand' })))
        .toBe(engine.NICHE_TYPES.LUXURY_BRAND);
    });

    it('returns LUXURY_BRAND for premium input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'premium watches' })))
        .toBe(engine.NICHE_TYPES.LUXURY_BRAND);
    });

    it('returns LUXURY_BRAND for heritage input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'heritage goods' })))
        .toBe(engine.NICHE_TYPES.LUXURY_BRAND);
    });

    it('returns SAAS for saas input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'saas platform' })))
        .toBe(engine.NICHE_TYPES.SAAS);
    });

    it('returns SAAS for software input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'software company' })))
        .toBe(engine.NICHE_TYPES.SAAS);
    });

    it('returns SAAS for tech input', () => {
      expect(engine.detectNiche(makeInput({ productService: 'tech startup' })))
        .toBe(engine.NICHE_TYPES.SAAS);
    });

    it('returns AGENCY for agency input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'marketing agency' })))
        .toBe(engine.NICHE_TYPES.AGENCY);
    });

    it('returns AGENCY for marketing input', () => {
      expect(engine.detectNiche(makeInput({ niche: 'marketing services' })))
        .toBe(engine.NICHE_TYPES.AGENCY);
    });

    it('returns GENERAL as fallback for unrecognized input', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'unknown type' })))
        .toBe(engine.NICHE_TYPES.GENERAL);
    });

    it('returns GENERAL for empty input', () => {
      expect(engine.detectNiche(makeInput({})))
        .toBe(engine.NICHE_TYPES.GENERAL);
    });

    it('is case-insensitive for niche detection', () => {
      expect(engine.detectNiche(makeInput({ businessType: 'RESTAURANT' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
      expect(engine.detectNiche(makeInput({ businessType: 'Restaurant' })))
        .toBe(engine.NICHE_TYPES.RESTAURANT);
    });
  });

  describe('getCinematographyTerms', () => {
    it('returns movement, framing, lighting, lens, and pacing arrays for general platform', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.DRAMATIC_TRAILER, 'general');
      expect(terms.movement).toBeDefined();
      expect(terms.framing).toBeDefined();
      expect(terms.lighting).toBeDefined();
      expect(terms.lens).toBeDefined();
      expect(terms.pacing).toBeDefined();
      expect(Array.isArray(terms.movement)).toBe(true);
      expect(Array.isArray(terms.framing)).toBe(true);
      expect(Array.isArray(terms.lighting)).toBe(true);
      expect(Array.isArray(terms.lens)).toBe(true);
      expect(Array.isArray(terms.pacing)).toBe(true);
    });

    it('returns trailer-specific terms for DRAMATIC_TRAILER', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.DRAMATIC_TRAILER, 'general');
      expect(terms.movement).toContain('cinematic push-in');
      expect(terms.pacing).toContain('fast-cut pacing');
    });

    it('returns non-trailer terms for CINEMATIC_SHORT_FILM', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.CINEMATIC_SHORT_FILM, 'general');
      expect(terms.movement).toContain('slow dolly in');
      expect(terms.movement).not.toContain('fast-cut pacing');
      expect(terms.pacing).toContain('slow refined pacing');
    });

    it('returns vertical-specific framing for TikTok platform', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.PROMO_FILM, 'TikTok');
      expect(terms.framing).toContain('tight emotional close-ups');
      expect(terms.framing).not.toContain('wide establishing shots');
    });

    it('returns vertical-specific framing for Instagram platform', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.PROMO_FILM, 'Instagram Reel');
      expect(terms.framing).toContain('tight emotional close-ups');
    });

    it('returns general framing for non-vertical platform', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.PROMO_FILM, 'YouTube');
      expect(terms.framing).toContain('wide establishing shots');
    });

    it('returns vertical framing for Reel platform', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.CASE_STUDY_FILM, 'Reel');
      expect(terms.framing).toContain('tight emotional close-ups');
    });

    it('returns consistent lighting and lens across platforms', () => {
      const terms1 = engine.getCinematographyTerms(engine.FILM_TYPES.PROMO_FILM, 'TikTok');
      const terms2 = engine.getCinematographyTerms(engine.FILM_TYPES.PROMO_FILM, 'general');
      expect(terms1.lighting).toEqual(terms2.lighting);
      expect(terms1.lens).toEqual(terms2.lens);
    });

    it('returns general platform as default', () => {
      const terms = engine.getCinematographyTerms(engine.FILM_TYPES.PROMO_FILM);
      expect(terms.framing).toContain('wide establishing shots');
    });
  });

  describe('getStoryBeats', () => {
    it('returns story beats for CINEMATIC_SHORT_FILM', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
      expect(beats).toEqual(['hook', 'subject introduction', 'emotional movement', 'visual payoff', 'ending reveal']);
    });

    it('returns story beats for DRAMATIC_TRAILER', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.DRAMATIC_TRAILER);
      expect(beats).toEqual(['tension hook', 'escalation', 'partial reveal', 'climax', 'title card / CTA']);
    });

    it('returns story beats for FOUNDER_STORY_FILM', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.FOUNDER_STORY_FILM);
      expect(beats).toEqual(['origin', 'struggle', 'mission', 'breakthrough', 'future / CTA']);
    });

    it('returns story beats for TESTIMONIAL_FILM', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.TESTIMONIAL_FILM);
      expect(beats).toEqual(['problem', 'frustration', 'solution', 'transformation', 'trust-building close']);
    });

    it('returns story beats for CASE_STUDY_FILM', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.CASE_STUDY_FILM);
      expect(beats).toEqual(['challenge', 'strategy', 'execution', 'result', 'proof / CTA']);
    });

    it('returns story beats for PROMO_FILM', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.PROMO_FILM);
      expect(beats).toEqual(['opening atmosphere shot', 'service introduction', 'value demonstration', 'offer reveal', 'CTA']);
    });

    it('returns story beats for CINEMATIC_COMMERCIAL', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.CINEMATIC_COMMERCIAL);
      expect(beats).toEqual(['attention hook', 'product hero shot', 'benefit showcase', 'lifestyle integration', 'brand close']);
    });

    it('returns story beats for DOCUMENTARY_STYLE_FILM', () => {
      const beats = engine.getStoryBeats(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM);
      expect(beats).toEqual(['environment establishing', 'subject introduction', 'process documentation', 'human element', 'authentic conclusion']);
    });

    it('falls back to CINEMATIC_SHORT_FILM beats for unknown film type', () => {
      const beats = engine.getStoryBeats('unknown-film-type');
      expect(beats).toEqual(['hook', 'subject introduction', 'emotional movement', 'visual payoff', 'ending reveal']);
    });

    it('falls back to CINEMATIC_SHORT_FILM beats for empty string', () => {
      const beats = engine.getStoryBeats('');
      expect(beats).toEqual(['hook', 'subject introduction', 'emotional movement', 'visual payoff', 'ending reveal']);
    });
  });

  describe('getNicheTerms', () => {
    it('returns niche terms for restaurant', () => {
      const terms = engine.getNicheTerms(engine.NICHE_TYPES.RESTAURANT);
      expect(terms).toContain('cinematic food close-ups');
      expect(terms).toContain('steam rising from plates');
      expect(terms.length).toBe(10);
    });

    it('returns niche terms for med spa', () => {
      const terms = engine.getNicheTerms(engine.NICHE_TYPES.MED_SPA);
      expect(terms).toContain('luxury treatment rooms');
      expect(terms).toContain('serene treatment environment');
      expect(terms.length).toBe(10);
    });

    it('returns niche terms for fitness', () => {
      const terms = engine.getNicheTerms(engine.NICHE_TYPES.FITNESS);
      expect(terms).toContain('high-energy training visuals');
      expect(terms.length).toBe(10);
    });

    it('returns niche terms for real estate', () => {
      const terms = engine.getNicheTerms(engine.NICHE_TYPES.REAL_ESTATE);
      expect(terms).toContain('sweeping property reveals');
      expect(terms.length).toBe(10);
    });

    it('returns niche terms for saas', () => {
      const terms = engine.getNicheTerms(engine.NICHE_TYPES.SAAS);
      expect(terms).toContain('clean interface screenshots');
      expect(terms.length).toBe(10);
    });

    it('returns general terms for unknown niche', () => {
      const terms = engine.getNicheTerms('unknown-niche');
      expect(terms).toEqual(engine.NICHE_TERMS[engine.NICHE_TYPES.GENERAL]);
    });

    it('returns general terms for empty string', () => {
      const terms = engine.getNicheTerms('');
      expect(terms).toEqual(engine.NICHE_TERMS[engine.NICHE_TYPES.GENERAL]);
    });
  });

  describe('composeNegativePrompt', () => {
    it('returns a string without undefined for luxury style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'luxury');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for dramatic style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'dramatic');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for documentary style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'documentary');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for commercial style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'commercial');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for bold style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'bold');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for minimal style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'minimal');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for warm style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'warm');
      expect(result).not.toContain('undefined');
    });

    it('returns a string without undefined for cool style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'cool');
      expect(result).not.toContain('undefined');
    });

    it('includes base negative terms', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'luxury');
      expect(result).toContain('blurry');
      expect(result).toContain('low-quality');
      expect(result).toContain('amateur');
      expect(result).toContain('poorly lit');
      expect(result).toContain('generic stock photo');
    });

    it('includes style-specific negative terms', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'luxury');
      expect(result).toContain('cheap');
      expect(result).toContain('tacky');
      expect(result).toContain('low-budget');
    });

    it('includes niche-specific negative terms', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'luxury');
      expect(result).toContain('fast food');
      expect(result).toContain('chain restaurant');
    });

    it('returns base for unknown style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'unknown-style');
      expect(result).toContain('blurry');
      expect(result).not.toContain('undefined');
    });

    it('does not include niche negatives for general niche', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'general-business', 'luxury');
      expect(result).not.toContain('fast food');
      expect(result).not.toContain('chain restaurant');
    });

    it('does not include style negative for unknown style', () => {
      const result = engine.composeNegativePrompt('dramatic-trailer', 'restaurant', 'unknown-style');
      expect(result).not.toContain('undefined');
    });
  });

  describe('buildTemplatePrompt', () => {
    const makeFullInput = (overrides = {}) => ({
      rawIdea: 'A trailer for our restaurant',
      templateType: '',
      objective: 'promote our brand',
      tone: 'dramatic',
      businessType: 'restaurant',
      niche: '',
      productService: 'fine dining',
      platform: 'YouTube',
      visualStyle: 'luxury',
      subject: 'our restaurant',
      duration: 10,
      aspectRatio: '16:9',
      cta: 'Book a table',
      ...overrides
    });

    it('returns an object with all expected keys', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result).toBeDefined();
      expect(result.filmType).toBeDefined();
      expect(result.niche).toBeDefined();
      expect(result.storyBeats).toBeDefined();
      expect(result.masterPrompt).toBeDefined();
      expect(result.shotPrompt).toBeDefined();
      expect(result.scenePrompts).toBeDefined();
      expect(result.voiceover).toBeDefined();
      expect(result.negativePrompt).toBeDefined();
      expect(result.enrichedPrompt).toBeDefined();
      expect(result.nicheTerms).toBeDefined();
    });

    it('detects DRAMATIC_TRAILER from rawIdea', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.filmType).toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('detects RESTAURANT niche from businessType', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.niche).toBe(engine.NICHE_TYPES.RESTAURANT);
    });

    it('masterPrompt contains the subject', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.masterPrompt).toContain('our restaurant');
    });

    it('masterPrompt contains the objective', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.masterPrompt).toContain('promote our brand');
    });

    it('masterPrompt contains aspect ratio and duration', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.masterPrompt).toContain('16:9');
      expect(result.masterPrompt).toContain('10s');
    });

    it('masterPrompt contains CTA when provided', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.masterPrompt).toContain('Book a table');
    });

    it('masterPrompt does not contain CTA when not provided', () => {
      const result = engine.buildTemplatePrompt(makeFullInput({ cta: '' }));
      expect(result.masterPrompt).not.toContain('Call to action');
    });

    it('shotPrompt contains shot composition sections', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.shotPrompt).toContain('Shot Composition:');
      expect(result.shotPrompt).toContain('Camera:');
      expect(result.shotPrompt).toContain('Framing:');
      expect(result.shotPrompt).toContain('Lens:');
      expect(result.shotPrompt).toContain('Pacing:');
    });

    it('scenePrompts returns array of scene objects', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(Array.isArray(result.scenePrompts)).toBe(true);
      expect(result.scenePrompts.length).toBeGreaterThan(0);
      expect(result.scenePrompts[0]).toHaveProperty('scene');
      expect(result.scenePrompts[0]).toHaveProperty('beat');
      expect(result.scenePrompts[0]).toHaveProperty('prompt');
      expect(result.scenePrompts[0]).toHaveProperty('nicheTerm');
    });

    it('voiceover contains tone and structure', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.voiceover.tone).toBe('dramatic');
      expect(result.voiceover.pacing).toBe('measured and intentional');
      expect(Array.isArray(result.voiceover.structure)).toBe(true);
      expect(result.voiceover.suggestion).toContain('Voiceover should guide through');
    });

    it('negativePrompt contains base and niche terms', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.negativePrompt).toContain('blurry');
      expect(result.negativePrompt).toContain('fast food');
      expect(result.negativePrompt).toContain('cheap');
    });

    it('enrichedPrompt contains niche and cinematic terms', () => {
      const result = engine.buildTemplatePrompt(makeFullInput());
      expect(result.enrichedPrompt).toContain('Cinematic enrichment');
      expect(result.enrichedPrompt).toContain('cinematic food close-ups');
    });

    it('handles empty input gracefully', () => {
      const result = engine.buildTemplatePrompt({});
      expect(result).toBeDefined();
      expect(result.masterPrompt).toBeDefined();
      expect(result.masterPrompt.length).toBeGreaterThan(0);
    });

    it('handles missing visualStyle by falling back to commercial', () => {
      const result = engine.buildTemplatePrompt(makeFullInput({ visualStyle: undefined }));
      expect(result.negativePrompt).toBeDefined();
      expect(result.negativePrompt).not.toContain('undefined');
    });
  });

  describe('CinematicTemplateBuilder', () => {
    it('instantiates with default values', () => {
      const builder = new engine.CinematicTemplateBuilder();
      expect(builder.filmType).toBe(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
      expect(builder.niche).toBe(engine.NICHE_TYPES.GENERAL);
      expect(builder.style).toBe(engine.CINEMATIC_STYLES.COMMERCIAL);
      expect(builder.inputs).toEqual({});
    });

    it('setFilmType updates filmType and returns this', () => {
      const builder = new engine.CinematicTemplateBuilder();
      const returned = builder.setFilmType(engine.FILM_TYPES.DRAMATIC_TRAILER);
      expect(builder.filmType).toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
      expect(returned).toBe(builder);
    });

    it('setNiche updates niche and returns this', () => {
      const builder = new engine.CinematicTemplateBuilder();
      const returned = builder.setNiche(engine.NICHE_TYPES.RESTAURANT);
      expect(builder.niche).toBe(engine.NICHE_TYPES.RESTAURANT);
      expect(returned).toBe(builder);
    });

    it('setStyle updates style and returns this', () => {
      const builder = new engine.CinematicTemplateBuilder();
      const returned = builder.setStyle(engine.CINEMATIC_STYLES.LUXURY);
      expect(builder.style).toBe(engine.CINEMATIC_STYLES.LUXURY);
      expect(returned).toBe(builder);
    });

    it('setInputs updates inputs and returns this', () => {
      const builder = new engine.CinematicTemplateBuilder();
      const inputs = { subject: 'test', platform: 'TikTok' };
      const returned = builder.setInputs(inputs);
      expect(builder.inputs).toEqual(inputs);
      expect(returned).toBe(builder);
    });

    it('build delegates to buildTemplatePrompt with merged inputs', () => {
      const builder = new engine.CinematicTemplateBuilder();
      builder.setFilmType(engine.FILM_TYPES.PROMO_FILM);
      builder.setNiche(engine.NICHE_TYPES.FITNESS);
      builder.setStyle(engine.CINEMATIC_STYLES.BOLD);
      builder.setInputs({ subject: 'gym', platform: 'YouTube', rawIdea: 'fitness promo', objective: 'get members', tone: 'energetic', businessType: 'gym', duration: 8, aspectRatio: '16:9', cta: 'Join now' });

      const result = builder.build();
      expect(result.filmType).toBe(engine.FILM_TYPES.PROMO_FILM);
      expect(result.niche).toBe(engine.NICHE_TYPES.FITNESS);
    });

    it('getStoryBeats uses current filmType', () => {
      const builder = new engine.CinematicTemplateBuilder();
      builder.setFilmType(engine.FILM_TYPES.TESTIMONIAL_FILM);
      const beats = builder.getStoryBeats();
      expect(beats).toEqual(['problem', 'frustration', 'solution', 'transformation', 'trust-building close']);
    });

    it('getNicheTerms uses current niche', () => {
      const builder = new engine.CinematicTemplateBuilder();
      builder.setNiche(engine.NICHE_TYPES.LUXURY_BRAND);
      const terms = builder.getNicheTerms();
      expect(terms).toEqual(engine.NICHE_TERMS[engine.NICHE_TYPES.LUXURY_BRAND]);
    });

    it('getCinematography uses current filmType and inputs.platform', () => {
      const builder = new engine.CinematicTemplateBuilder();
      builder.setFilmType(engine.FILM_TYPES.DRAMATIC_TRAILER);
      builder.setInputs({ platform: 'TikTok' });
      const terms = builder.getCinematography();
      expect(terms.movement).toContain('cinematic push-in');
      expect(terms.framing).toContain('tight emotional close-ups');
    });

    it('getCinematography handles missing platform', () => {
      const builder = new engine.CinematicTemplateBuilder();
      builder.setFilmType(engine.FILM_TYPES.PROMO_FILM);
      const terms = builder.getCinematography();
      expect(terms.framing).toContain('wide establishing shots');
    });

    it('supports chaining setFilmType -> setNiche -> setStyle -> setInputs -> build', () => {
      const result = new engine.CinematicTemplateBuilder()
        .setFilmType(engine.FILM_TYPES.CASE_STUDY_FILM)
        .setNiche(engine.NICHE_TYPES.LEGAL)
        .setStyle(engine.CINEMATIC_STYLES.DOCUMENTARY)
        .setInputs({ subject: 'law firm', platform: 'LinkedIn', rawIdea: 'case study video', objective: 'showcase win', tone: 'professional', businessType: 'legal', duration: 12, aspectRatio: '16:9', cta: 'Contact us' })
        .build();

      expect(result.filmType).toBe(engine.FILM_TYPES.CASE_STUDY_FILM);
      expect(result.niche).toBe(engine.NICHE_TYPES.LEGAL);
      expect(result.masterPrompt).toContain('law firm');
      expect(result.masterPrompt).toContain('Contact us');
    });
  });

  describe('inferFilmTypeFromBlueprint', () => {
    it('returns PROMO_FILM for CTA blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('cta and offer')).toBe(engine.FILM_TYPES.PROMO_FILM);
    });

    it('returns PROMO_FILM for offer blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('special offer reveal')).toBe(engine.FILM_TYPES.PROMO_FILM);
    });

    it('returns FOUNDER_STORY_FILM for origin blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('origin story and struggle')).toBe(engine.FILM_TYPES.FOUNDER_STORY_FILM);
    });

    it('returns FOUNDER_STORY_FILM for struggle blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('early struggle and growth')).toBe(engine.FILM_TYPES.FOUNDER_STORY_FILM);
    });

    it('returns TESTIMONIAL_FILM for problem blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('problem faced by customer')).toBe(engine.FILM_TYPES.TESTIMONIAL_FILM);
    });

    it('returns TESTIMONIAL_FILM for transformation blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('amazing transformation')).toBe(engine.FILM_TYPES.TESTIMONIAL_FILM);
    });

    it('returns CASE_STUDY_FILM for challenge blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('business challenge and result')).toBe(engine.FILM_TYPES.CASE_STUDY_FILM);
    });

    it('returns CASE_STUDY_FILM for result blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('final result and proof')).toBe(engine.FILM_TYPES.CASE_STUDY_FILM);
    });

    it('returns DRAMATIC_TRAILER for tension blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('tension building and climax')).toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('returns DRAMATIC_TRAILER for climax blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('climax and title card')).toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('returns DOCUMENTARY_STYLE_FILM for context blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('context and process')).toBe(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM);
    });

    it('returns DOCUMENTARY_STYLE_FILM for process blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('process documentation')).toBe(engine.FILM_TYPES.DOCUMENTARY_STYLE_FILM);
    });

    it('returns CINEMATIC_SHORT_FILM for unknown blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('random unrelated text')).toBe(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
    });

    it('returns CINEMATIC_SHORT_FILM for empty blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint('')).toBe(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
    });

    it('returns CINEMATIC_SHORT_FILM for null blueprint', () => {
      expect(engine.inferFilmTypeFromBlueprint(null)).toBe(engine.FILM_TYPES.CINEMATIC_SHORT_FILM);
    });

    it('is case-insensitive', () => {
      expect(engine.inferFilmTypeFromBlueprint('ORIGIN')).toBe(engine.FILM_TYPES.FOUNDER_STORY_FILM);
      expect(engine.inferFilmTypeFromBlueprint('Climax')).toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });
  });

  describe('deriveEngineInputFromTemplate', () => {
    it('derives input from formState only', () => {
      const formState = {
        prompt: 'my idea',
        templateType: 'founder-story-film',
        businessType: 'restaurant',
        tone: 'inspirational',
        niche: 'auto-detect',
        subject: 'chef',
        platform: 'TikTok',
        visualStyle: 'dramatic',
        duration: 15,
        cta: 'Visit us'
      };
      const result = engine.deriveEngineInputFromTemplate({}, formState);
      expect(result.rawIdea).toBe('my idea');
      expect(result.templateType).toBe('founder-story-film');
      expect(result.objective).toBe('restaurant');
      expect(result.tone).toBe('inspirational');
      expect(result.niche).toBe('');
      expect(result.subject).toBe('chef');
      expect(result.platform).toBe('TikTok');
      expect(result.visualStyle).toBe('dramatic');
      expect(result.duration).toBe(15);
      expect(result.cta).toBe('Visit us');
    });

    it('falls back to template fields when formState is empty', () => {
      const template = {
        promptDirection: 'template direction',
        filmFamily: 'testimonial-film',
        coreUseCase: 'marketing',
        name: 'Template Name',
        aspectRatio: '9:16',
        duration: { default: 20 },
        niche: 'salon'
      };
      const result = engine.deriveEngineInputFromTemplate(template, {});
      expect(result.rawIdea).toBe('template direction');
      expect(result.templateType).toBe('testimonial-film');
      expect(result.objective).toBe('marketing');
      expect(result.subject).toBe('Template Name');
      expect(result.platform).toBe('TikTok Reel');
      expect(result.duration).toBe(20);
      expect(result.aspectRatio).toBe('9:16');
      expect(result.niche).toBe('salon');
    });

    it('infers filmType from storyBlueprint when templateType and formState.templateType are absent', () => {
      const template = {
        storyBlueprint: 'tension and climax reveal',
        promptDirection: 'trailer vibe'
      };
      const result = engine.deriveEngineInputFromTemplate(template, {});
      expect(result.templateType).toBe(engine.FILM_TYPES.DRAMATIC_TRAILER);
    });

    it('uses template.aspectRatios[0] when aspectRatio is absent', () => {
      const template = {
        aspectRatios: ['9:16', '1:1']
      };
      const result = engine.deriveEngineInputFromTemplate(template, {});
      expect(result.aspectRatio).toBe('9:16');
    });

    it('defaults duration to 5 when neither formState nor template provide it', () => {
      const result = engine.deriveEngineInputFromTemplate({}, {});
      expect(result.duration).toBe(5);
    });

    it('defaults aspectRatio to 16:9 when neither template nor formState provide it', () => {
      const result = engine.deriveEngineInputFromTemplate({}, {});
      expect(result.aspectRatio).toBe('16:9');
    });

    it('defaults platform to general when not vertical', () => {
      const result = engine.deriveEngineInputFromTemplate({ aspectRatio: '16:9' }, {});
      expect(result.platform).toBe('general');
    });

    it('prefers formState.niche over template.niche when formState.niche is not auto-detect', () => {
      const template = { niche: 'salon' };
      const formState = { niche: 'restaurant' };
      const result = engine.deriveEngineInputFromTemplate(template, formState);
      expect(result.niche).toBe('restaurant');
    });

    it('falls back to template.niche when formState.niche is auto-detect', () => {
      const template = { niche: 'salon' };
      const formState = { niche: 'auto-detect' };
      const result = engine.deriveEngineInputFromTemplate(template, formState);
      expect(result.niche).toBe('salon');
    });

    it('returns object with all expected keys', () => {
      const result = engine.deriveEngineInputFromTemplate({}, {});
      expect(result).toHaveProperty('rawIdea');
      expect(result).toHaveProperty('templateType');
      expect(result).toHaveProperty('objective');
      expect(result).toHaveProperty('tone');
      expect(result).toHaveProperty('businessType');
      expect(result).toHaveProperty('niche');
      expect(result).toHaveProperty('productService');
      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('visualStyle');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('aspectRatio');
      expect(result).toHaveProperty('cta');
    });
  });

  describe('enrichPromptString', () => {
    it('returns enriched prompt with niche terms and cinematography', () => {
      const result = engine.enrichPromptString('A great video', {
        niche: 'restaurant',
        visualStyle: 'luxury',
        platform: 'TikTok',
        filmType: 'dramatic-trailer'
      });
      expect(result).toContain('A great video');
      expect(result).toContain('Cinematic enrichment');
      expect(result).toContain('cinematic food close-ups');
      expect(result).toContain('cinematic push-in');
    });

    it('returns empty string plus enrichment for empty basePrompt', () => {
      const result = engine.enrichPromptString('', {
        niche: 'fitness',
        visualStyle: 'bold',
        platform: 'general',
        filmType: 'promo-film'
      });
      expect(result).toContain('Cinematic enrichment');
    });

    it('handles missing options gracefully', () => {
      const result = engine.enrichPromptString('test prompt', {});
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('uses general niche terms when niche is unknown', () => {
      const result = engine.enrichPromptString('test', {
        niche: 'unknown-niche',
        visualStyle: 'commercial',
        platform: 'general',
        filmType: 'promo-film'
      });
      expect(result).toContain('professional business environment');
    });

    it('does not contain double spaces after cleaning', () => {
      const result = engine.enrichPromptString('test  prompt', {
        niche: 'saas',
        visualStyle: 'minimal',
        platform: 'general',
        filmType: 'case-study-film'
      });
      expect(result).not.toMatch(/\s{2,}/);
    });

    it('does not contain undefined', () => {
      const result = engine.enrichPromptString('test', {
        niche: 'restaurant',
        visualStyle: 'luxury',
        platform: 'general',
        filmType: 'dramatic-trailer'
      });
      expect(result).not.toContain('undefined');
    });
  });

  describe('getEngineOutputModes', () => {
    it('returns an array of mode objects', () => {
      const modes = engine.getEngineOutputModes();
      expect(Array.isArray(modes)).toBe(true);
      expect(modes.length).toBe(5);
    });

    it('each mode has mode and label properties', () => {
      const modes = engine.getEngineOutputModes();
      for (const mode of modes) {
        expect(mode).toHaveProperty('mode');
        expect(mode).toHaveProperty('label');
        expect(typeof mode.mode).toBe('string');
        expect(typeof mode.label).toBe('string');
      }
    });

    it('mode values match OUTPUT_MODES values', () => {
      const modes = engine.getEngineOutputModes();
      const modeValues = modes.map(m => m.mode);
      expect(modeValues).toContain('master_prompt');
      expect(modeValues).toContain('shot_enhanced_prompt');
      expect(modeValues).toContain('scene_prompt_pack');
      expect(modeValues).toContain('voiceover_direction');
      expect(modeValues).toContain('negative_prompt');
    });

    it('label values match OUTPUT_MODE_LABELS', () => {
      const modes = engine.getEngineOutputModes();
      for (const mode of modes) {
        expect(engine.OUTPUT_MODE_LABELS[mode.mode]).toBe(mode.label);
      }
    });
  });

  describe('cleanPrompt behavior via enrichPromptString', () => {
    it('does not contain double spaces after cleaning', () => {
      const result = engine.enrichPromptString('test  prompt', {
        niche: 'saas',
        visualStyle: 'minimal',
        platform: 'general',
        filmType: 'case-study-film'
      });
      expect(result).not.toMatch(/\s{2,}/);
    });

    it('does not contain undefined', () => {
      const result = engine.enrichPromptString('test', {
        niche: 'restaurant',
        visualStyle: 'luxury',
        platform: 'general',
        filmType: 'dramatic-trailer'
      });
      expect(result).not.toContain('undefined');
    });

    it('does not contain double commas', () => {
      const result = engine.enrichPromptString('test,, prompt', {
        niche: 'general-business',
        visualStyle: 'commercial',
        platform: 'general',
        filmType: 'promo-film'
      });
      expect(result).not.toContain(',,');
    });

    it('trims leading and trailing junk', () => {
      const result = engine.enrichPromptString('  ,.-test-,.-  ', {
        niche: 'general-business',
        visualStyle: 'commercial',
        platform: 'general',
        filmType: 'promo-film'
      });
      expect(result).not.toMatch(/^[\s,.\-]+/);
      expect(result).not.toMatch(/[\s,.\-]+$/);
    });

    it('collapses multiple spaces', () => {
      const result = engine.enrichPromptString('word    word   word', {
        niche: 'general-business',
        visualStyle: 'commercial',
        platform: 'general',
        filmType: 'promo-film'
      });
      expect(result).not.toMatch(/\s{2,}/);
    });

    it('handles empty string input', () => {
      const result = engine.enrichPromptString('', {
        niche: 'general-business',
        visualStyle: 'commercial',
        platform: 'general',
        filmType: 'promo-film'
      });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
