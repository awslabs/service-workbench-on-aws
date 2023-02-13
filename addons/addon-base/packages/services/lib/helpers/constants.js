const idRegex = '^[A-Za-z0-9-_]+$';
const nameRegex = '^[A-Za-z0-9-_ ]+$';
const userNameRegex =
  '^([^.%+!$&*=^|~#%{}]+)[a-zA-Z0-9\\._%+!$&*=^|~#%{}/\\-]+([^.!]+)@([^-.!](([a-zA-Z0-9\\-]+\\.){1,}([a-zA-Z]{2,63})))';
const emailIdpRegex = '^[A-Za-z0-9-_.]+$|^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$';
const nonHtmlRegex = '^([^<>{}]*)$';
const firstLastNameRegex = '^[A-Za-z0-9 .-]+$';
module.exports = {
  idRegex,
  nameRegex,
  userNameRegex,
  emailIdpRegex,
  nonHtmlRegex,
  firstLastNameRegex,
};
