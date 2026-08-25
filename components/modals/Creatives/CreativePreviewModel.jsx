import React,{useEffect, useState} from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Preview from '../../common/projectDataList/Preview';

const CreativePreviewModel = ({ onUseHandler, onCancelHadler, preview, activeItem, instantStart, show, setShow }) => {
    const previewClose = () => setShow(false);
    useEffect(() => {
    setShow(true);

    },[])
    return (
        <Modal show={show} onHide={previewClose} animation={false} className={"preview-model"}>
            <div className="preview-image-lt-container">
                <Modal.Header className='preview-header'>
                    <Modal.Title className='preview-title'>{activeItem.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Preview
                        preview={preview}
                        activeItem={activeItem}
                        instantStart={instantStart}
                    />
                </Modal.Body>
                <Modal.Footer className='preview-footer'>
                    <Button className='preview-image-lt-use-button'  onClick={onUseHandler}>
                        Use
                    </Button>
                    <Button className='preview-image-lt-cancel-button' onClick={onCancelHadler}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </div>
        </Modal>
    )
}
export default CreativePreviewModel