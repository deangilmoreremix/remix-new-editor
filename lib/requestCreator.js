import { xmlToJson } from './utils/xml-parser';

function trimLeft(str, replacement) {
  while (str.charAt(0) === replacement) {
    str = str.substr(1);
  }
  return str;
}

/**
 * Prepend host of API server
 * @param hostname
 * @param path
 * @param isServer
 * @returns {String}
 * @private
 */
function createURL(hostname, path, isServer) {
  console.log(hostname);
  if (hostname.indexOf('http://') === 0 || hostname.indexOf('https://') === 0) {
    return `${hostname}/${trimLeft(path, '/')}`;
  }

  if (!isServer) {
    return `//${hostname}/${trimLeft(path, '/')}`;
  } else {
    return `http://${hostname}/${trimLeft(path, '/')}`;
  }
}

/**
 * Parse response
 * @param resp
 * @param isServer
 * @returns {Promise}
 * @private
 */
function handleResponse(resp, isServer = false) {
  const redirect = resp.headers.get('Location');
  if (redirect) {
    if (!isServer) {
      window.location.replace(redirect);
    }
    // TODO: Handle this V
    // eslint-disable-next-line prefer-promise-reject-errors
    return Promise.reject({ redirect });
  }

  const contentType = resp.headers && resp.headers.get('Content-Type');
  const isJSON = contentType && contentType.includes('json');
  const isXML = contentType && contentType.includes('xml');
  let response;
  switch (true) {
    case isJSON: {
      response = resp.json();
      break;
    }
    case isXML: {
      response = resp.text().then(text => xmlToJson(text));
      break;
    }
    default: {
      response = resp.text();
    }
  }

  return resp.ok ? response : response.then((err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('requestError:', err);
    }
    throw err;
  });
}

/**
 * This is our overly complicated isomorphic "request"
 * @param hostname
 * @param authorization
 * @param isServer
 * @param refreshFn
 * @returns {Function}
 */
export default (
  hostname,
  authorization,
  isServer = false,
  refreshFn,
) => async (url, requestOptions = {}) => {
  let currentAuthorization = authorization;

  const requestURL = createURL(hostname, url, isServer);
  if (!requestOptions.headers) {
    requestOptions.headers = {};
  }

  const { headers } = requestOptions;

  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    requestOptions.body = JSON.stringify(requestOptions.body);
    Object.assign(requestOptions.headers, {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  }
  if (process.env.DEV) {
    console.info('requestURL:', requestURL);
  }

  // Append token to the headers
  if (headers.Authorization || currentAuthorization) {
    headers.Authorization = headers.Authorization || currentAuthorization;
  }

  let resp = await fetch(requestURL, requestOptions);
  if (resp.status === 401 && refreshFn) {
    currentAuthorization = await refreshFn();
    resp = await fetch(requestURL, requestOptions);
  }
  return handleResponse(resp, isServer);
};

export const loadUrl = async url => fetch(url).then(handleResponse);

export const loadImage = async url => new Promise((resolve, reject) => {
  const img = new Image();
  img.setAttribute('crossOrigin', 'anonymous');
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.onabort = reject;
  img.src = url;
});
