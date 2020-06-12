/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import defaultLoginImage from '../../images/login-image.gif';
import defaultMainLogo from '../../images/main-logo.png';
import defaultPageFavicon from '../../images/favicon.ico';

const isLocalDev = process.env.REACT_APP_LOCAL_DEV === 'true';
const awsRegion = process.env.REACT_APP_AWS_REGION;
const apiPath = process.env.REACT_APP_API_URL;
const websiteUrl = process.env.REACT_APP_WEBSITE_URL;
const stage = process.env.REACT_APP_STAGE;
const region = process.env.REACT_APP_REGION;
const autoLogoutTimeoutInMinutes = process.env.REACT_APP_AUTO_LOGOUT_TIMEOUT_IN_MINUTES || 5;

// Check at buildtime if custom images are stored in the '../../../../main/solution/ui/src/custom-images' folder.
function importAll(r) {
  return r.keys().map(r);
}

// require.context() is parsed at build-time by webpack so it only accepts literals as arguments
const customFavicons = importAll(
  require.context('../../../../../../main/solution/ui/src/custom-images', false, /\bcustom-favicon\b\.ico$/),
);
const customLoginImages = importAll(
  require.context(
    '../../../../../../main/solution/ui/src/custom-images',
    false,
    /\bcustom-login-image\b\.(png|jpe?g|svg|gif)$/,
  ),
);
const customMainLogos = importAll(
  require.context(
    '../../../../../../main/solution/ui/src/custom-images',
    false,
    /\bcustom-main-logo\b\.(png|jpe?g|svg|gif)$/,
  ),
);

const branding = {
  login: {
    title: process.env.REACT_APP_BRAND_LOGIN_TITLE,
    subtitle: process.env.REACT_APP_BRAND_LOGIN_SUBTITLE,
    image: customLoginImages.length > 0 ? customLoginImages[0] : defaultLoginImage,
  },
  main: {
    title: process.env.REACT_APP_BRAND_MAIN_TITLE,
    logo: customMainLogos.length > 0 ? customMainLogos[0] : defaultMainLogo,
  },
  page: {
    title: process.env.REACT_APP_BRAND_PAGE_TITLE,
    favicon: customFavicons.length > 0 ? customFavicons[0] : defaultPageFavicon,
  },
};

export { awsRegion, apiPath, isLocalDev, websiteUrl, stage, region, branding, autoLogoutTimeoutInMinutes };
