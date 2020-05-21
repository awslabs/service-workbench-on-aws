const isLocalDev = process.env.REACT_APP_LOCAL_DEV === 'true';
const awsRegion = process.env.REACT_APP_AWS_REGION;
const apiPath = process.env.REACT_APP_API_URL;
const websiteUrl = process.env.REACT_APP_WEBSITE_URL;
const stage = process.env.REACT_APP_STAGE;
const region = process.env.REACT_APP_REGION;
const autoLogoutTimeoutInMinutes = process.env.REACT_APP_AUTO_LOGOUT_TIMEOUT_IN_MINUTES || 5;

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

export { awsRegion, apiPath, isLocalDev, websiteUrl, stage, region, branding, autoLogoutTimeoutInMinutes };
