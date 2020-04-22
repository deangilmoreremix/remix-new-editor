import React, { useState, useRef } from 'react';
import { observer } from 'mobx-react';
import arrayMove from 'array-move';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Box, List, ListItem, Button } from '@material-ui/core';

import { optInTemplate } from '../../lib/generators/iframe';

import FormTextArea from '../form/FormTextArea';

import useProjectStore from '../hooks/useProjectStore';

const SortableItem = SortableElement(({ value }) => <ListItem>{value}</ListItem>);
const SortableList = SortableContainer(({ items }) => (
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
  const { personalizations } = projectStore;
  const [tokens, toggleTokens] = useState([...personalizations.values()]);
  const textareaRef = useRef();

  const toggle = ({ oldIndex, newIndex }) => {
    const movedTokens = arrayMove(tokens, oldIndex, newIndex);
    toggleTokens(movedTokens);
    const textarea = textareaRef.current;
    textarea.select();
  };

  return (
    <div className="retarget-opt-in-modal">
      <Box> 1) Reorder personalized tokens by dragging as they defined at your form:</Box>
      <SortableList items={tokens} onSortEnd={toggle} />
      <Box> 2) Copy & Paste this embed code inside the custom HTML element:</Box>
      <FormTextArea
        inputClassName="opt-in-textarea"
        rows="10"
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
