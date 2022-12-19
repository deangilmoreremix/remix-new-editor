import { useState } from 'react';

// import { pintura } from '@pqina/pintura/pintura.module.css';
import { pintura } from '../../../styles/components/Pintura.scss';

// react-pintura
import { PinturaEditor, PinturaEditorModal, PinturaEditorOverlay } from '@pqina/react-pintura';
console.log(PinturaEditor,"pintura")

// pintura
import { getEditorDefaults } from '@pqina/pintura';


// const editorDefaults = {

//     imageReader: createDefaultImageReader(),
//     imageWriter: createDefaultImageWriter(),
//     shapePreprocessor: createDefaultShapePreprocessor(),
//     ...plugin_finetune_defaults,
//     ...plugin_filter_defaults,
//     ...markup_editor_defaults,
//     locale: {
//         ...locale_en_gb,
//         ...plugin_crop_locale_en_gb,
//         ...plugin_finetune_locale_en_gb,
//         ...plugin_filter_locale_en_gb,
//         ...plugin_annotate_locale_en_gb,
//         ...markup_editor_locale_en_gb,
//     },
// };

export default function PinturaImageEditorModal() {
    // inline
    const editorConfig = getEditorDefaults();

    return (
        <div className="App" style={{ height: '600px' }}>
            <PinturaEditor
                {...editorConfig}
                src="https://cdn.vidcloud.io/src/plugins/personalizedImage/personalizedImage-circlePlaceholder.png"
                imageCropAspectRatio={1}
            ></PinturaEditor>
        </div>
    );
}
