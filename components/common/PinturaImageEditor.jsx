import { useState } from 'react';

import { pintura } from '@pqina/pintura/pintura.module.css';
import '../../styles/PinturaEditor.css';
import PropTypes from '../../lib/PropTypes';

import { getEditorDefaults,createDefaultImageWriter } from '@pqina/pintura';
import { LibrarySpinnerRed } from '../media/Loader';
import useUIStore from '../hooks/useUIStore';
import { tabItems } from '../../lib/constants/library';
import useMediaStore from '../hooks/useMediaStore';
import { PinturaEditor } from '@pqina/react-pintura';
import { observer } from 'mobx-react';

const editorDefaults = getEditorDefaults();

const PinturaImageEditor = observer(({
    handleClose, options, onImageEdited,
    startUpload,
    endUpload,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const { uploadMedia, storeAsset } = useMediaStore();
    const {
        secondaryWindowType: activeTab,
    } = useUIStore();
    const handleEditorProcess = async (imageWriterResult) => {
        const { dest } = imageWriterResult;
        var reader = new FileReader();
        reader.readAsDataURL(dest);
        reader.onloadend = async function () {
            const base64data = reader.result;
            const base64Response = await fetch(`${base64data}`);
            const blob = await base64Response.blob();
            let media;
            let hasError;
            try {
                setIsLoading(true);
                startUpload();
                media = await uploadMedia({ data: blob, isCrop: true });
                const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
                let fileType = activeTab;
                Object.keys(tabItems).forEach((item) => {
                    tabItems[item].formats.forEach((format) => {
                        if (format === fileExtension) {
                            fileType = item;
                        }
                    });
                });
                await storeAsset(media, fileType);
            } catch (e) {
                hasError = true;
                console.log(e.message)
            } finally {
                setIsLoading(false);
                let image = media && media.url;
                if (!hasError) {
                    onImageEdited(image);
                }
                handleClose();
                endUpload()
            }
        }
    };
    return (
        <div className="pintura">
            {isLoading &&
                <div className='pintura-loader'>
                    <LibrarySpinnerRed />
                </div>
            }
            <div style={{ height: '70vh' }}>
                <PinturaEditor
                    {...editorDefaults}
                    className={pintura}
                    src={options.src}
                    onLoad={(res) => console.log('load inline image', res)}
                    imageWriter={createDefaultImageWriter({
                        mimeType: 'image/jpeg',
                        quality: 80,
                        format: 'file'
                    })}
                    onProcess={handleEditorProcess}
                />
            </div>
        </div>
    );
});
// }
PinturaImageEditor.propTypes = {
    onImageEdited: PropTypes.func.isRequired,
    startUpload: PropTypes.func.isRequired,
    endUpload: PropTypes.func.isRequired,
    noCrop: PropTypes.bool.isRequired,
};
export default PinturaImageEditor;