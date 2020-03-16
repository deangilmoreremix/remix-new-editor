import * as React from 'react';
import { observer } from 'mobx-react';

// COMPONENTS
import DropzoneArea from './DropzoneArea';
import MediaLibrary from './MediaLibrary';

// HOOKS
import useProjectStore from '../hooks/useProjectStore';

export default observer(() => {
  const { assets, addAsset } = useProjectStore();
  const [isDropzoneShown, toggleDropzone] = React.useState(true);

  React.useEffect(() => {
    if (assets && assets.length) {
      toggleDropzone(false);
    }
  }, []);

  const onMediaUploaded = (asset) => {
    toggleDropzone(false);
    addAsset(asset);
  };

  const showDropzone = () => toggleDropzone(true);

  return (
    <div className="media-container">
      {isDropzoneShown && <DropzoneArea onUploaded={onMediaUploaded} />}
      {
        !isDropzoneShown
          && assets.length
          && <MediaLibrary addMedia={showDropzone} assets={assets} />
      }
    </div>
  );
});
