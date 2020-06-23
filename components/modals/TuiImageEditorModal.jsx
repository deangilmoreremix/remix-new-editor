import React from 'react';
import '../../styles/components/modals/TuiImageEditorModal.scss';
import ImageEditor from '@toast-ui/react-image-editor';

const TuiImageEditorModal = (image) => (
  <ImageEditor
    includeUI={{

      // theme: myTheme,
      menu: ['crop', 'flip', 'rotate', 'shape', 'icon', 'text', 'mask', 'filter'],
      initMenu: 'crop',
      uiSize: {
        width: '700px',
        height: '500px',
      },
      menuBarPosition: 'bottom',
    }}
    cssMaxHeight={500}
    cssMaxWidth={700}
    selectionStyle={{
      cornerSize: 20,
      rotatingPointOffset: 70,
    }}
    // usageStatistics={true}
  />
);

export default TuiImageEditorModal;
