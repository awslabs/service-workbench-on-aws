# @amzn/base-raas-appstream-cfn-templates, @amzn/base-raas-appstream-rest-api and @amzn/base-raas-appstream-services

These packages implement the server side changes to RaaS to secure workspaces using AppStream. AppStream is deployed in the on-boarded research account. Rather than returning the workspace connection URL, these changes return the url to an AppStream session (per user-environment pair) that will provide access to the workspace.
