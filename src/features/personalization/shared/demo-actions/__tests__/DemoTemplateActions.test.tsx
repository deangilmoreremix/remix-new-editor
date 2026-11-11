// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import React from 'react';
import { DemoTemplateActions, DEMO_ACTION_LABELS } from '../DemoTemplateActions';

describe('DemoTemplateActions', () => {
  it('renders the three canonical action labels in order', () => {
    render(
      <DemoTemplateActions
        onViewPrompt={() => {}}
        onPersonalize={() => {}}
        onCreateStyle={() => {}}
      />,
    );

    const buttons = [...screen.getAllByRole('button')].map((btn) => btn.textContent?.trim());
    expect(buttons).toEqual([
      DEMO_ACTION_LABELS.viewPrompt,
      DEMO_ACTION_LABELS.personalize,
      DEMO_ACTION_LABELS.createStyle,
    ]);
  });

  it('renders create as a link when createHref is provided', () => {
    render(
      <DemoTemplateActions
        onViewPrompt={() => {}}
        onPersonalize={() => {}}
        onCreateStyle={() => {}}
        createHref="/studio/video?template=seedance-25|test"
      />,
    );

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/studio/video?template=seedance-25|test');
    expect(link.textContent?.trim()).toBe(DEMO_ACTION_LABELS.createStyle);
  });

  it('does not allow label drift through props', () => {
    const { container } = render(
      <DemoTemplateActions
        onViewPrompt={() => {}}
        onPersonalize={() => {}}
        onCreateStyle={() => {}}
      />,
    );

    const allText = container.textContent || '';
    expect(allText).toContain(DEMO_ACTION_LABELS.viewPrompt);
    expect(allText).toContain(DEMO_ACTION_LABELS.personalize);
    expect(allText).toContain(DEMO_ACTION_LABELS.createStyle);
    expect(allText).not.toContain('Create This Type of Video');
    expect(allText).not.toContain('Open in Studio');
    expect(allText).not.toContain('Open Source');
  });

  it('renders the create action as a button when no createHref is provided', () => {
    render(
      <DemoTemplateActions
        onViewPrompt={() => {}}
        onPersonalize={() => {}}
        onCreateStyle={() => {}}
      />,
    );

    const buttons = screen.getAllByRole('button');
    const createButton = buttons.find((btn) => btn.textContent?.trim() === DEMO_ACTION_LABELS.createStyle);
    expect(createButton).toBeDefined();
  });
});
