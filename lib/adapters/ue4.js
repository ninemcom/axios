'use strict';

var utils = require('axios/lib/utils');
var settle = require('axios/lib/core/settle');
var buildURL = require('axios/lib/helpers/buildURL');
var parseHeaders = require('axios/lib/helpers/parseHeaders');
var isURLSameOrigin = require('axios/lib/helpers/isURLSameOrigin');
var createError = require('axios/lib/core/createError');
var btoa = (typeof window !== 'undefined' && window.btoa && window.btoa.bind(window)) || require('./../helpers/btoa');

module.exports = function ue4(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    var request = new JavascriptHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    // set verb (GET, POST, ...)
    request.SetVerb(config.method.toUpperCase());

    // set url
    var url = buildURL(config.url, config.params, config.paramsSerializer);
    request.SetURL(url);

    // Set the request timeout in MS (TOOD)
    // request.timeout = config.timeout;

    // Listen for ready state
    request.OnComplete.Add( success => {

      // Handle low level network errors
      if (!success) {
        reject(createError('Network Error', config, null, request));

        // Clean up request
        request = null;
        return;
      }

      if (!request || !request.IsValid() || request.GetStatus() != 'Succeeded') {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.GetResponseCode() === 0 && !(url.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      // reading header is not implemented (TODO)
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = undefined;
      if (config.responseType === 'arraybuffer') {
        // save content to ArrayBuffer
        let buffer = new ArrayBuffer(request.GetContentLength());
        memory.exec(buffer, ab => request.GetContentToMemory());
        responseData = buffer;
      } else if (!config.responseType || config.responseType === 'text') {
        responseData = request.GetContentAsString();
      } else {
        responseData = JSON.parse(request.GetContentAsString());
      }

      var response = {
        data: responseData,
        // IE sends 1223 instead of 204 (https://github.com/axios/axios/issues/201)
        status: request.GetResponseCode() === 1223 ? 204 : request.GetResponseCode(),
        statusText: request.GetResponseCode() === 1223 ? 'No Content' : request.GetContentAsString(),
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    });

    // Handle timeout (TODO)
    // request.ontimeout = function handleTimeout() {
    //   reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
    //     request));

    //   // Clean up request
    //   request = null;
    // };

    // Add headers to the request
    utils.forEach(requestHeaders, function setRequestHeader(val, key) {
      if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
        // Remove Content-Type if data is undefined
        delete requestHeaders[key];
      } else {
        // Otherwise add header to the request
        request.SetHeader(key, val);
      }
    });

    // Add withCredentials to request if needed (TODO)
    // if (config.withCredentials) {
    //   request.withCredentials = true;
    // }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.OnProgress.Add((upload, download) => config.onDownloadProgress(download));
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.OnProgress.Add((upload, download) => config.onUploadProgress(upload));
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.CancelRequest();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = 'null';
    }

    // Send the request
    request.SetContentAsString(requestData);
    request.ProcessRequest();
  });
};
