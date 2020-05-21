// Inspired by the IAM request context idea https://docs.aws.amazon.com/IAM/latest/UserGuide/intro-structure.html
class RequestContext {
  constructor() {
    this.actions = [];
    this.resources = [];
    this.authenticated = false;
    this.principal = undefined;
    this.attr = {};
  }
}

module.exports = RequestContext;
