import _ from 'lodash';
import { parseError, delay, removeNulls } from './utils';
import { apiPath } from './settings';

/* eslint-disable import/no-mutable-exports */
let config = {
  apiPath,
  fetchMode: 'cors',
  maxRetryCount: 4,
};

let token;
let decodedIdToken;
const authHeader = tok => ({ Authorization: `${tok}` });

function setIdToken(idToken, decodedToken) {
  token = idToken;
  decodedIdToken = decodedToken;
}

function getDecodedIdToken() {
  return decodedIdToken;
}

function isTokenExpired() {
  // Date.now() returns epoch time in MILLISECONDS
  const expiresAt = _.get(decodedIdToken, 'exp', 0) * 1000;
  return Date.now() >= expiresAt;
}

function forgetIdToken() {
  token = undefined;
  decodedIdToken = undefined;
}

function configure(obj) {
  config = { ...config, ...obj };
}

function fetchJson(url, options = {}, retryCount = 0) {
  // see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
  let isOk = false;
  let httpStatus;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const body = '';
  const merged = {
    method: 'GET',
    cache: 'no-cache',
    mode: config.fetchMode,
    redirect: 'follow',
    body,
    ...options,
    headers: { ...headers, ...options.headers },
  };

  if (merged.method === 'GET') delete merged.body; // otherwise fetch will throw an error

  if (merged.params) {
    // if query string parameters are specified then add them to the URL
    // The merged.params here is just a plain JavaScript object with key and value
    // For example {key1: value1, key2: value2}

    // Get keys from the params object such as [key1, key2] etc
    const paramKeys = _.keys(merged.params);

    // Filter out params with undefined or null values
    const paramKeysToPass = _.filter(paramKeys, key => !_.isNil(_.get(merged.params, key)));
    const query = _.map(
      paramKeysToPass,
      key => `${encodeURIComponent(key)}=${encodeURIComponent(_.get(merged.params, key))}`,
    ).join('&');
    url = query ? `${url}?${query}` : url;
  }

  return Promise.resolve()
    .then(() => fetch(url, merged))
    .catch(err => {
      // this will capture network/timeout errors, because fetch does not consider http Status 5xx or 4xx as errors
      if (retryCount < config.maxRetryCount) {
        let backoff = retryCount * retryCount;
        if (backoff < 1) backoff = 1;

        return Promise.resolve()
          .then(() => console.log(`Retrying count = ${retryCount}, Backoff = ${backoff}`))
          .then(() => delay(backoff))
          .then(() => fetchJson(url, options, retryCount + 1));
      }
      throw parseError(err);
    })
    .then(response => {
      isOk = response.ok;
      httpStatus = response.status;
      return response;
    })
    .then(response => {
      if (_.isFunction(response.text)) return response.text();
      return response;
    })
    .then(text => {
      let json;
      try {
        if (_.isObject(text)) {
          json = text;
        } else {
          json = JSON.parse(text);
        }
      } catch (err) {
        if (httpStatus >= 400) {
          if (httpStatus >= 501 && retryCount < config.maxRetryCount) {
            let backoff = retryCount * retryCount;
            if (backoff < 1) backoff = 1;

            return Promise.resolve()
              .then(() => console.log(`Retrying count = ${retryCount}, Backoff = ${backoff}`))
              .then(() => delay(backoff))
              .then(() => fetchJson(url, options, retryCount + 1));
          }
          throw parseError({
            message: text,
            status: httpStatus,
          });
        } else {
          throw parseError(new Error('The server did not return a json response.'));
        }
      }

      return json;
    })
    .then(json => {
      if (_.isBoolean(isOk) && !isOk) {
        throw parseError({ ...json, status: httpStatus });
      } else {
        return json;
      }
    });
}

// ---------- helper functions ---------------

function httpApiGet(urlPath, { params } = {}) {
  return fetchJson(`${config.apiPath}/${urlPath}`, {
    method: 'GET',
    headers: authHeader(token),
    params,
  });
}

function httpApiPost(urlPath, { data, params } = {}) {
  return fetchJson(`${config.apiPath}/${urlPath}`, {
    method: 'POST',
    headers: authHeader(token),
    params,
    body: JSON.stringify(data),
  });
}

function httpApiPut(urlPath, { data, params } = {}) {
  return fetchJson(`${config.apiPath}/${urlPath}`, {
    method: 'PUT',
    headers: authHeader(token),
    params,
    body: JSON.stringify(data),
  });
}

// eslint-disable-next-line no-unused-vars
function httpApiDelete(urlPath, { data, params } = {}) {
  return fetchJson(`${config.apiPath}/${urlPath}`, {
    method: 'DELETE',
    headers: authHeader(token),
    params,
    body: JSON.stringify(data),
  });
}

// ---------- api calls ---------------

function authenticate(authenticationUrl, username, password, authenticationProviderId) {
  return fetchJson(authenticationUrl, {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      authenticationProviderId,
    }),
  });
}

function logout() {
  if (isTokenExpired()) {
    // if token is already expired then no need to call logout API to revoke token just return
    return { expired: true, revoked: false };
  }
  return httpApiPost('api/authentication/logout');
}

function getApiKeys({ username, ns } = {}) {
  return httpApiGet('api/api-keys', { params: { username, ns } });
}

function createNewApiKey({ username, ns } = {}) {
  return httpApiPost('api/api-keys', { params: { username, ns } });
}

function revokeApiKey(apiKeyId, { username, ns } = {}) {
  return httpApiPut(`api/api-keys/${apiKeyId}/revoke`, { params: { username, ns } });
}

function getUser() {
  return httpApiGet('api/user');
}

function addUser(user) {
  const params = {};
  if (user.authenticationProviderId) {
    params.authenticationProviderId = user.authenticationProviderId;
  }
  if (user.identityProviderName) {
    params.identityProviderName = user.identityProviderName;
  }
  return httpApiPost('api/users', { data: removeNulls(user), params });
}

function updateUser(user) {
  const params = {};
  if (user.authenticationProviderId) {
    params.authenticationProviderId = user.authenticationProviderId;
  }
  if (user.identityProviderName) {
    params.identityProviderName = user.identityProviderName;
  }
  return httpApiPut(`api/users/${user.username}`, { data: removeNulls(user), params });
}

function getUsers() {
  return httpApiGet('api/users');
}

function getAuthenticationProviderPublicConfigs() {
  return httpApiGet('api/authentication/public/provider/configs');
}
function getAuthenticationProviderConfigs() {
  return httpApiGet('api/authentication/provider/configs');
}

function updateAuthenticationProviderConfig(authenticationProvider) {
  return httpApiPut('api/authentication/provider/configs', { data: authenticationProvider });
}

export {
  configure,
  setIdToken,
  getDecodedIdToken,
  fetchJson,
  httpApiGet,
  httpApiPost,
  httpApiPut,
  httpApiDelete,
  getAuthenticationProviderPublicConfigs,
  getAuthenticationProviderConfigs,
  updateAuthenticationProviderConfig,
  forgetIdToken,
  getApiKeys,
  createNewApiKey,
  revokeApiKey,
  getUser,
  addUser,
  updateUser,
  getUsers,
  authenticate,
  logout,
  config,
};
