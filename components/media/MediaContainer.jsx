import * as React from 'react';
import { observer } from 'mobx-react';

import useProjectStore from '../hooks/useProjectStore';
import DropzoneArea from './DropzoneArea';
import MediaLibrary from './MediaLibrary';

export default observer(() => {
  const { assets, updateAssets } = useProjectStore();
  const [isDropzoneShown, toggleDropzone] = React.useState(true);

  React.useEffect(() => {
    if (assets && assets.length) {
      toggleDropzone(false);
    }
  }, []);

  const onMediaUploaded = (asset) => {
    toggleDropzone(false);
    updateAssets(asset);
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
