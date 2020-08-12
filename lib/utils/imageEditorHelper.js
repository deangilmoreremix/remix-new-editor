export const getFormatFromContentType = (contentType) => contentType.split('/')[1];

export const getImageSize = (image) => new Promise((resolve, reject) => {
  if (image.width && image.height) {
    return resolve({ width: image.width, height: image.height });
  }
  const imageMeta = new Image();
  imageMeta.src = image.src || image.url || image;
  imageMeta.onload = () => resolve({
    height: imageMeta.naturalHeight,
    width: imageMeta.naturalWidth,
  });
  imageMeta.onerror = () => reject(new Error('Invalid Image Url'));
});
