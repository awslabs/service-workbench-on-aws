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

const isLocalDev = process.env.REACT_APP_LOCAL_DEV === 'true';
const awsRegion = process.env.REACT_APP_AWS_REGION;
const apiPath = process.env.REACT_APP_API_URL;
const websiteUrl = process.env.REACT_APP_WEBSITE_URL;
const stage = process.env.REACT_APP_STAGE;
const region = process.env.REACT_APP_REGION;
const autoLogoutTimeoutInMinutes = process.env.REACT_APP_AUTO_LOGOUT_TIMEOUT_IN_MINUTES || 30;

const branding = {
  login: {
    title: process.env.REACT_APP_BRAND_LOGIN_TITLE,
    subtitle: process.env.REACT_APP_BRAND_LOGIN_SUBTITLE,
  },
  main: {
    title: process.env.REACT_APP_BRAND_MAIN_TITLE,
  },
  page: {
    title: process.env.REACT_APP_BRAND_PAGE_TITLE,
  },
};

const versionAndDate = process.env.REACT_APP_VERSION_AND_DATE;

export {
  awsRegion,
  apiPath,
  isLocalDev,
  websiteUrl,
  stage,
  region,
  branding,
  autoLogoutTimeoutInMinutes,
  versionAndDate,
};
