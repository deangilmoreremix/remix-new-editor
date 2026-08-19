import React, { useState, useRef } from 'react';
import { observer } from 'mobx-react';
import arrayMove from 'array-move';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Box, List, ListItem, Button } from '@material-ui/core';

import { optInTemplate } from '../../lib/generators/iframe';

import FormTextArea from '../form/FormTextArea';

import useProjectStore from '../hooks/useProjectStore';

// Safe wrappers that handle the case where react-sortable-hoc's class-based
// HOCs are stubbed in certain environments (e.g. esbuild/vite dev server
// without full React class component support). The standard call
// `SortableElement(...)` throws "Class constructor cannot be invoked without
// 'new'", so we fall back to `new` and then to a plain pass-through wrapper.
function safeSortableElement(factory) {
  try {
    return SortableElement(factory);
  } catch (e) {
    try {
      return new SortableElement(factory);
    } catch (e2) {
      // Fall back to the raw component (no drag sorting) in broken environments
      return factory;
    }
  }
}

function safeSortableContainer(factory) {
  try {
    return SortableContainer(factory);
  } catch (e) {
    try {
      return new SortableContainer(factory);
    } catch (e2) {
      // Fall back to the raw component (no drag sorting) in broken environments
      return factory;
    }
  }
}

const SortableItem = safeSortableElement(({ value }) => <ListItem>{value}</ListItem>);
const SortableList = safeSortableContainer(({ items }) => (
  <List component="nav" aria-label="secondary">
    {items.map((value, index) => (
      <SortableItem
        key={`sortable-item-${value}`}
        index={index}
        sortIndex={index}
        value={value}
      />
    ))}
  </List>
));

const RetargetOptInModal = observer(({ handleClose }) => {
  const projectStore = useProjectStore();
  const { getPersonalization } = projectStore;
  const [tokens, toggleTokens] = useState(getPersonalization());
  const textareaRef = useRef();

  const toggle = ({ oldIndex, newIndex }) => {
    const movedTokens = arrayMove(tokens, oldIndex, newIndex);
    toggleTokens(movedTokens);
    const textarea = textareaRef.current;
    if (textarea) textarea.select();
  };

  return (
    <div className="retarget-opt-in-modal">
      <Box> 1) Reorder personalized tokens by dragging as they defined at your form:</Box>
      <SortableList items={tokens} onSortEnd={toggle} />
      <Box> 2) Copy & Paste this embed code inside the custom HTML element:</Box>
      <FormTextArea
        inputClassName="opt-in-textarea"
        rows={10}
        inputRef={textareaRef}
        value={optInTemplate(tokens)}
        multiline
      />
      <Box>
        <Button
          variant="outlined"
          color="default"
          className="done-button"
          onClick={handleClose}
        >
          Done
        </Button>
      </Box>
    </div>
  );
});

export default RetargetOptInModal;
