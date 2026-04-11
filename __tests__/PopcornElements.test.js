import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PopcornElements } from '../components/common/timeline/PopcornElements.js';
import { getStore } from '../components/base/Store.js';

// Mock dependencies
vi.mock('../components/base/Store.js');
vi.mock('../src/lib/utils/timeline');
vi.mock('../src/lib/utils/dropItemOnTimeline');
vi.mock('../components/common/timeline/PopcornElement.js');
vi.mock('../components/common/timeline/TransitionButton.js');

describe('PopcornElements', () => {
  let mockProjectStore;
  let mockTimelineStore;
  let instance;

  beforeEach(() => {
    mockProjectStore = {
      layers: [{ id: 1, order: 0 }],
      elements: [{
        id: 'elem1',
        track: 1,
        popcornOptions: {
          id: 'elem1',
          start: 0,
          end: 10,
          duration: 10,
          animation: null,
          outDuration: 0,
        },
        type: 'video',
        dimensions: { width: 100, height: 50 },
      }],
      duration: 100,
      activeElementId: null,
      setIsAddingTransition: vi.fn(),
      removeTransition: vi.fn(),
      removedTransition: false,
      setUndo: vi.fn(),
      projectData: { media: [] },
      updateVideoDuration: vi.fn(),
      updateElementFromTimeline: vi.fn(),
      createNewElement: vi.fn(),
      changeDuration: vi.fn(),
    };

    mockTimelineStore = {
      setTimelineSelectedItems: vi.fn(),
      setActiveRow: vi.fn(),
      setTimeOnClick: vi.fn(),
      setContextMenu: vi.fn(),
      releaseElement: vi.fn(),
      setIsActiveTimeline: vi.fn(),
      timelineSelectedItems: [],
      activeElementId: null,
      contextMenu: { buttons: [] },
      copiedItems: [],
    };

    getStore.mockImplementation((storeName) => {
      if (storeName === 'projectStore') return mockProjectStore;
      if (storeName === 'timelineStore') return mockTimelineStore;
      return {};
    });

    instance = new PopcornElements({
      startDate: new Date(),
      endDate: new Date(Date.now() + 100000),
      startDateWithZoom: new Date(),
      endDateWithZoom: new Date(Date.now() + 100000),
      sortableWidth: 200,
      layersRef: { current: null },
    });
  });

  describe('Enhanced PopcornElement Integration', () => {
    it('should pass onChange handler to PopcornElement for updating element properties', () => {
      // Mock PopcornElement constructor
      const PopcornElementMock = vi.fn();
      PopcornElementMock.prototype.render = vi.fn(() => document.createElement('div'));
      
      // Spy on PopcornElement creation
      const originalPopcornElement = require('./PopcornElement.js').default;
      require('./PopcornElement.js').default = PopcornElementMock;

      // Render components
      instance.render();

      // Verify PopcornElement was created with onChange
      expect(PopcornElementMock).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.any(Object),
          onChange: expect.any(Function),
          fields: expect.any(Object),
          element: expect.any(Object),
        })
      );

      // Restore original
      require('./PopcornElement.js').default = originalPopcornElement;
    });

    it('should update element when onChange is called from PopcornElement', () => {
      // This would require mocking the render and calling onChange
      // Since PopcornElement is mocked, we can test the handler logic
      const changes = { from: 5, end: 15 };
      const elementId = 'elem1';

      // Simulate onChange call
      instance.handleElementChange(elementId, changes);

      expect(mockProjectStore.updateElementFromTimeline).toHaveBeenCalledWith({
        elementId,
        ...changes,
      });
    });

    it('should handle trimming changes across multiple elements', () => {
      // Test that changes to one element don't affect others
      const changes1 = { from: 2 };
      const changes2 = { end: 20 };

      instance.handleElementChange('elem1', changes1);
      instance.handleElementChange('elem2', changes2);

      expect(mockProjectStore.updateElementFromTimeline).toHaveBeenCalledTimes(2);
      expect(mockProjectStore.updateElementFromTimeline).toHaveBeenNthCalledWith(1, {
        elementId: 'elem1',
        ...changes1,
      });
      expect(mockProjectStore.updateElementFromTimeline).toHaveBeenNthCalledWith(2, {
        elementId: 'elem2',
        ...changes2,
      });
    });

    it('should support transition insertion between elements', () => {
      const transition = { start: 5, end: 7 };
      const element = mockProjectStore.elements[0];

      instance.insertTransition({ transition, element });

      expect(mockProjectStore.setIsAddingTransition).toHaveBeenCalledWith(true);
      expect(mockProjectStore.createNewElement).toHaveBeenCalled();
      expect(mockProjectStore.setIsAddingTransition).toHaveBeenCalledWith(false);
    });

    it('should maintain grid layout when elements are edited', () => {
      // Test that render still produces valid layouts after changes
      const result = instance.render();
      expect(result).toBeInstanceOf(HTMLDivElement);
      expect(result.className).toContain('timeline-container');
    });

    it('should handle drop target functionality with edited elements', () => {
      const mockMonitor = {};
      const mockAction = vi.fn();

      instance.onDropElement({ action: mockAction }, mockMonitor);

      // The drop logic should still work
      expect(mockAction).toHaveBeenCalled();
    });
  });
});