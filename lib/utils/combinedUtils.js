export const createItemsInCombinedElement = ({ items, videoContainer, blockOptions, action }) => {
  const { width, height, top, left, start, end } = blockOptions;

  const videoContainerWidth = videoContainer.offsetWidth;
  const videoContainerHeight = videoContainer.offsetHeight;

  items.forEach(item => {
    const newBlockWidthInPx = (videoContainerWidth / 100) * width;
    const itemWidthInPx = (videoContainerWidth / 100) * item.width;
    const newWidth = (itemWidthInPx / newBlockWidthInPx) * 100;

    const newBlockHeightInPx = (videoContainerHeight / 100) * height;
    const itemHeightInPx = (videoContainerHeight / 100) * item.height;
    const newHeight = (itemHeightInPx / newBlockHeightInPx) * 100;

    const newBlockTopInPx = (videoContainerHeight / 100) * top;
    const itemTopInPx = (videoContainerHeight / 100) * item.top;
    const topDifference = itemTopInPx - newBlockTopInPx;
    const newTop = (topDifference / newBlockHeightInPx) * 100;

    const newBlockLeftInPx = (videoContainerWidth / 100) * left;
    const itemLeftInPx = (videoContainerWidth / 100) * item.left;
    const leftDifference = itemLeftInPx - newBlockLeftInPx;
    const newLeft = (leftDifference / newBlockWidthInPx) * 100;

    delete item.isSuperAdmin;

    item.startDifference = item.start - start;
    item.endDifference = end - item.end;
    item.width = newWidth;
    item.height = newHeight;
    item.top = newTop;
    item.left = newLeft;

    action(item.id);
  });
};

export const destroyCombined = ({ items, videoContainer, blockOptions, action }) => {
  const { width, height, top, left, start, end } = blockOptions;

  const videoContainerWidth = videoContainer.offsetWidth;
  const videoContainerHeight = videoContainer.offsetHeight;

  items.reverse().forEach(item => {
    const newBlockWidthInPx = (videoContainerWidth / 100) * width;
    const itemWidthInPx = (newBlockWidthInPx / 100) * item.width;
    const newWidth = (itemWidthInPx / videoContainerWidth) * 100;

    const newBlockHeightInPx = (videoContainerHeight / 100) * height;
    const itemHeightInPx = (newBlockHeightInPx / 100) * item.height;
    const newHeight = (itemHeightInPx / videoContainerHeight) * 100;

    const newBlockTopInPx = (videoContainerHeight / 100) * top;
    const itemTopInPx = (newBlockHeightInPx / 100) * item.top;
    const topDifference = itemTopInPx + newBlockTopInPx;
    const newTop = (topDifference / videoContainerHeight) * 100;

    const newBlockLeftInPx = (videoContainerWidth / 100) * left;
    const itemLeftInPx = (newBlockWidthInPx / 100) * item.left;
    const leftDifference = itemLeftInPx + newBlockLeftInPx;
    const newLeft = (leftDifference / videoContainerWidth) * 100;

    item.start = start + item.startDifference;
    item.end = end - item.endDifference;
    item.width = newWidth;
    item.height = newHeight;
    item.top = newTop;
    item.left = newLeft;
    item.blendMode = null;
    item.opacity = null;
    item.id = null;
    item._id = null;
    item.track = null;
    item.zindex = null;

    action(item);
  });
};
