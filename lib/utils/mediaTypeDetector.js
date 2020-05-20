import Bb from 'bluebird';
import URI from './uri';

const REGEX_MAP = {
  YouTube: /^(?:https?:\/\/www\.|https?:\/\/m\.|https?:\/\/|www\.|\.|^)youtu/,
  Video360: /vr360:\/\/(.)*\.(mp4|m3u8|mpd)/,
  Adaptive: /((.)*\.(mp4|m3u8|mpd)?)+\|((.)*\.(mp4|m3u8|mpd)\|?)+/,
  Vimeo: /^(?:https?:\/\/www\.|https?:\/\/|www\.|\.|^)(vimeo\.com(\/[A-z0-9]*)+|player\.vimeo\.com\/video\/\d+)/,
  SoundCloud: /^(?:https?:\/\/www\.|https?:\/\/|www\.|\.|^)(w\.)?(soundcloud)/,
  Archive: /^(?:https?:\/\/www\.|https?:\/\/|www\.|\.|^)archive\.org\/(details|download|stream)\/((.*)start([/=])[\d.]+(.*)end(\/|=)[\d.]+)?/,
  Image: /((https|http)?:\/\/.*\.(?:png|jpg|jpeg|bmp|svg))/,
  // supports #t=<start>,<duration>
  // where start or duration can be: X, X.X or XX:XX
  null: /^\s*#t=(?:\d*(?:(?:\.|:)?\d+)?),?(\d+(?:(?:\.|:)\d+)?)\s*$/,
  Flickr: /^https?:\/\/(www\.)?flickr\.com/,
  Clyp: /^https?:\/\/(www\.)?(staging\.)?(?:clyp\.it|audiour\.com)/,
};

const handleFetchResponse = async (resp) => {
  const contentType = resp.headers && resp.headers.get('Content-Type');
  const isJSON = contentType && contentType.includes('json');
  const response = resp[isJSON ? 'json' : 'text']();

  return resp.ok ? response : response.then((err) => {
    if (process.env.DEV) {
      console.error('requestError:', err);
    }
    throw err;
  });
};

class MediaTypeDetector {
  constructor() {
    this.contentTypeDetectionEndpoint = '/api/get-content-type';
    this.uri = new URI();
  }

  extractYouTubeDuration(duration) {
    let a = duration.match(/\d+/g);
    if (duration.indexOf('M') >= 0 && duration.indexOf('H') === -1 && duration.indexOf('S') === -1) {
      a = [0, a[0], 0];
    }
    if (duration.indexOf('H') >= 0 && duration.indexOf('M') === -1) {
      a = [a[0], 0, a[1]];
    }
    if (duration.indexOf('H') >= 0 && duration.indexOf('M') === -1 && duration.indexOf('S') === -1) {
      a = [a[0], 0, 0];
    }
    duration = 0;
    if (a.length === 3) {
      duration += parseInt(a[0], 10) * 3600;
      duration += parseInt(a[1], 10) * 60;
      duration += parseInt(a[2], 10);
    }
    if (a.length === 2) {
      duration += parseInt(a[0], 10) * 60;
      duration += parseInt(a[1], 10);
    }
    if (a.length === 1) {
      duration += parseInt(a[0], 10);
    }
    return duration;
  }

  checkUrl(url) {
    return Object.keys(REGEX_MAP).find(mediaType => REGEX_MAP[mediaType].test(url)) || 'HTML5';
  }

  async getMetadata(baseUrl, contentType) {
    baseUrl = decodeURI(baseUrl);
    const type = this.checkUrl(baseUrl);
    if (type === 'YouTube') {
      const parsedUri = this.uri.parse(baseUrl);
      const id = parsedUri.queryKey.v || parsedUri.directory.replace(/\/(embed\/)?/, '');
      if (!id) {
        return;
      }

      const xhrURL = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${id}&key=AIzaSyC-t0srJyedCcUSL4kEIQkUkJ15eFPwNwc&alt=json`;
      const resp = await handleFetchResponse(await fetch(xhrURL, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }));
      const videoData = resp.items[0];
      if (typeof (videoData) === 'undefined') {
        throw new Error('This YouTube video is unplayable');
      }

      const snippetData = videoData.snippet;
      let from = parsedUri.queryKey.t;

      if (resp.error) {
        if (resp.error.code === 403) {
          throw new Error('Private Video');
        }
        throw new Error('This YouTube video is unplayable');
      }

      if (!snippetData) {
        return;
      }

      if (resp.items[0].status.embeddable !== true) {
        throw new Error('Embedding of this YouTube video is disabled');
      }

      if (from) {
        from = from.replace(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/, (all, hours, minutes, seconds) => {
          // Make sure we have real zeros
          /*  eslint-disable */
          hours |= 0; // bit-wise OR
          minutes |= 0; // bit-wise OR
          seconds |= 0; // bit-wise OR
          /*  eslint-enable */
          return (+seconds + (((hours * 60) + minutes) * 60));
        });
      }

      const isVideo360 = videoData.contentDetails && videoData.contentDetails.projection === '360';
      return {
        source: `http://www.youtube.com/watch?v=${id}`,
        title: snippetData.title,
        type,
        thumbnail: (snippetData.thumbnails.standard || snippetData.thumbnails.high).url,
        author: snippetData.channelTitle,
        duration: this.extractYouTubeDuration(videoData.contentDetails.duration) > 0
          ? this.extractYouTubeDuration(videoData.contentDetails.duration) - 1
          : 15, // if result NaN use 15 secs default value
        from,
        projection: isVideo360,
      };
    } else if (type === 'Vimeo') {
      const id = (await handleFetchResponse(
        await fetch(`https://vimeo.com/api/oembed.json?url=${baseUrl}`, {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
      )).video_id;
      const xhrURL = `https://vimeo.com/api/v2/video/${id}.json`;
      let resp;
      try {
        resp = await handleFetchResponse(await fetch(xhrURL, {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }));
      } catch (e) {
        throw new Error('This Vimeo video is unplayable');
      }

      const source = `http://player.vimeo.com/video/${id}`;
      if (!resp) {
        throw new Error('This Vimeo video is unplayable');
      }

      if (resp[0]) {
        resp = resp && resp[0];
      }
      return {
        source,
        type,
        thumbnail: resp.thumbnail_large || resp.thumbnail_medium,
        duration: resp.duration,
        title: resp.title,
      };
    } else {
      if (type === 'Adaptive') {
        baseUrl = baseUrl.split('|').find(url => url.split('.').reverse()[0] === 'mp4')
          || baseUrl.split('|').find(url => url.split('.').reverse()[0] === 'webm')
          || baseUrl.split('|').find(url => url.split('.').reverse()[0] === 'ogv');
      }
      const title = baseUrl.substring(baseUrl.lastIndexOf('/') + 1);
      const encodedBaseUrl = encodeURI(baseUrl);
      let mediaElem;

      const errorOptions = {
        source: encodedBaseUrl,
        type,
        title,
      };

      let successOptions = {
        source: encodedBaseUrl,
        type,
        title,
        thumbnail: this.uri.makeUnique(encodedBaseUrl).toString(),
      };

      if (!contentType) {
        const xhrURL = `${this.contentTypeDetectionEndpoint}?url=${encodeURIComponent(baseUrl)}`;
        const resp = await handleFetchResponse(await fetch(xhrURL, {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }));

        ({ contentType } = resp);

        if (resp.error || !contentType) {
          throw new Error(resp.error);
        }
      }

      successOptions.contentType = contentType;
      errorOptions.contentType = contentType;

      if (contentType.indexOf('video') === 0 || contentType.indexOf('application/octet-stream') === 0) {
        mediaElem = document.createElement('video');
      } else if (contentType.indexOf('audio') === 0 || contentType.indexOf('audio/mpeg') === 0) {
        mediaElem = document.createElement('audio');
        successOptions.hidden = true;
        errorOptions.hidden = true;
      } else if (contentType.indexOf('image') === 0) {
        mediaElem = document.createElement('img');
        mediaElem.src = encodedBaseUrl;
        successOptions = {
          source: encodedBaseUrl,
          type: 'HTML5',
          thumbnail: encodedBaseUrl,
          title: encodedBaseUrl,
          contentType,
          duration: 5,
        };
        return Bb.fromCallback((callback) => {
          mediaElem.addEventListener('load', () => {
            successOptions.width = mediaElem.naturalWidth;
            successOptions.height = mediaElem.naturalHeight;
            callback(null, successOptions);
          });
          mediaElem.addEventListener('error', () => {
            callback(new Error('This image is unavailable'));
          });
        });
      }

      if (mediaElem) {
        return Bb.fromCallback((callback) => {
          mediaElem.addEventListener('loadedmetadata', () => {
            successOptions.duration = mediaElem.duration;
            callback(null, successOptions);
          });
          mediaElem.addEventListener('error', () => {
            callback(new Error('This media is unplayable'));
          });
          mediaElem.src = encodedBaseUrl;
        });
      } else {
        throw new Error('This media is unplayable');
      }
    }
  }
}

export default MediaTypeDetector;
