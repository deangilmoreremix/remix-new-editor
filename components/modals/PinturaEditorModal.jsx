import { pintura } from '@pqina/pintura/pintura.module.css';

// Import the editor default configuration
import { getEditorDefaults } from '@pqina/pintura';

// Import the editor component from `react-pintura`
import { PinturaEditor } from '@pqina/react-pintura';

function PinturaEditorModal() {
    // get default properties
    const editorConfig = getEditorDefaults();

    return (
        <div className="PinturaEditorModal" style={{ height: '600px' }}>
            <PinturaEditor
                {...editorConfig}
                src="./my-image.jpeg"
                imageCropAspectRatio={1}
            ></PinturaEditor>
        </div>
    );
}

export default PinturaEditorModal;
