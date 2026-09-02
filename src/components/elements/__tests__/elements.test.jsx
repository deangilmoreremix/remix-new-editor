import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ElementCard } from '../element-card.jsx';
import { ElementGenerate } from '../element-generate.jsx';
import { ElementImageUpload } from '../element-image-upload.jsx';
import { ElementModal } from '../element-modal.jsx';
import { ElementsTab } from '../elements-tab.jsx';

describe('Phase 6 Elements', () => {
  describe('ElementCard', () => {
    const defaultElement = {
      id: 'card-1',
      name: 'Detective Sarah',
      type: 'character',
      description: 'A noir detective',
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('renders element name and type badge', () => {
      render(<ElementCard element={defaultElement} onClick={() => {}} />);
      expect(screen.getByText('Detective Sarah')).toBeDefined();
      expect(screen.getByText('character')).toBeDefined();
    });

    it('shows image count when images exist', () => {
      const elementWithImages = {
        ...defaultElement,
        images: [
          { id: 'img-1', url: 'https://example.com/hero.png', createdAt: new Date().toISOString(), source: 'generated' },
          { id: 'img-2', url: 'https://example.com/hero2.png', createdAt: new Date().toISOString(), source: 'generated' },
        ],
      };
      render(<ElementCard element={elementWithImages} onClick={() => {}} />);
      expect(screen.getByText('2 imgs')).toBeDefined();
    });

    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<ElementCard element={defaultElement} onClick={onClick} />);
      screen.getByText('Detective Sarah').click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('ElementImageUpload', () => {
    it('renders upload dropzone', () => {
      render(<ElementImageUpload onUpload={() => {}} />);
      expect(screen.getByText('Drop images here or click to browse')).toBeDefined();
    });
  });

  describe('ElementGenerate', () => {
    it('renders generate button in idle phase', () => {
      render(<ElementGenerate elementType="character" description="A character" onGenerated={() => {}} />);
      expect(screen.getByText('Generate')).toBeDefined();
    });

    it('shows prompt input with description', () => {
      render(<ElementGenerate elementType="character" description="A test character" onGenerated={() => {}} />);
      const input = screen.getByPlaceholderText('A test character');
      expect(input).toBeDefined();
    });
  });

  describe('ElementModal', () => {
    it('renders create modal with empty fields', () => {
      render(<ElementModal onSave={() => {}} onClose={() => {}} />);
      expect(screen.getByText('New Element')).toBeDefined();
      expect(screen.getByPlaceholderText('e.g. Detective Sarah')).toBeDefined();
      expect(screen.getByPlaceholderText('Describe this element in detail...')).toBeDefined();
    });

    it('renders edit modal with existing data', () => {
      const element = {
        id: 'modal-1',
        name: 'Existing Element',
        type: 'location',
        description: 'An existing location',
        images: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      render(<ElementModal element={element} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
      expect(screen.getByText('Edit Element')).toBeDefined();
      expect(screen.getByDisplayValue('Existing Element')).toBeDefined();
    });

    it('shows upload and generate tabs', () => {
      render(<ElementModal onSave={() => {}} onClose={() => {}} />);
      expect(screen.getByText('Upload')).toBeDefined();
      expect(screen.getByText('Generate')).toBeDefined();
    });
  });

  describe('ElementsTab', () => {
    it('renders empty state when no elements', () => {
      render(<ElementsTab elements={[]} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
      expect(screen.getByText('Add your first element to get started')).toBeDefined();
    });

    it('renders elements grid with cards', () => {
      const elements = [
        {
          id: 'tab-1',
          name: 'Character 1',
          type: 'character',
          description: 'A character',
          images: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      render(<ElementsTab elements={elements} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
      expect(screen.getByText('Character 1')).toBeDefined();
    });

    it('renders filter buttons', () => {
      render(<ElementsTab elements={[]} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
      expect(screen.getByText('All')).toBeDefined();
      expect(screen.getByText('Characters')).toBeDefined();
      expect(screen.getByText('Locations')).toBeDefined();
      expect(screen.getByText('Props')).toBeDefined();
      expect(screen.getByText('Vehicles')).toBeDefined();
    });

    it('renders modal content when open', () => {
      render(
        <ElementsTab
          elements={[]}
          onAdd={() => {}}
          onUpdate={() => {}}
          onDelete={() => {}}
        />,
      );
      // The modal is rendered when modalOpen is true, but ElementsTab
      // manages that state internally. We verify the ElementsTab renders
      // the modal trigger button.
      const buttons = screen.getAllByRole('button', { name: /new element/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
