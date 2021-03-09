module.exports = {
  serviceWorkbenchSidebar: {
    ServiceWorkBench: ["introduction"],
    "Deployment Guide": [
      "deployment/about_this_guide",
      "deployment/summary",
      "deployment/deployment_stages",
      {
        "Pre Deployment": [
          "deployment/pre_deployment/pre_deployment",
          "deployment/pre_deployment/accounts",
          "deployment/pre_deployment/prereq_commands",
          "deployment/pre_deployment/deployment_instance",
          "deployment/pre_deployment/source_code",
          "deployment/pre_deployment/configuration",
        ],
      },
      "deployment/deployment/index",
      {
        "Post Deployment": [
          "deployment/post_deployment/index",
          "deployment/post_deployment/account_structure",
          // "deployment/post_deployment/cost_explorer",
          "deployment/post_deployment/aws_accounts",
          "deployment/post_deployment/create_index_project",
          "deployment/post_deployment/create_admin_user",
          "deployment/post_deployment/import_service_catalog_products",
          "deployment/post_deployment/logs",
        ],
      },
      {
        Configuration: [
          {
            Authentication: [
              "deployment/configuration/auth/enabling_ad",
              "deployment/configuration/auth/configuring_auth0",
              "deployment/configuration/auth/configuring_idp",
            ],
          },
        ],
      },
      "deployment/redeployment",
      {
        Reference: [
          "deployment/reference/iam_role",
          "deployment/reference/aws_services",
          "deployment/reference/prepare_master_account"
        ],
      },
    ],
    "User Guide": [
      "user_guide/account_structure",
      "user_guide/introduction",
      {
        Sidebar: [
          {
            "Researcher View": [
              "user_guide/sidebar/common/dashboard/introduction",
              {
                Studies: [
                  "user_guide/sidebar/common/studies/introduction",
                  "user_guide/sidebar/common/studies/creating_a_study",
                  "user_guide/sidebar/common/studies/data_sources",
                  "user_guide/sidebar/common/studies/studies_page",
                  "user_guide/sidebar/common/studies/sharing_a_study",
                ],
                Workspaces: [
                  "user_guide/sidebar/common/workspaces/introduction",
                  "user_guide/sidebar/common/workspaces/create_workspace_study",
                  "user_guide/sidebar/common/workspaces/accessing_a_workspace",
                  "user_guide/sidebar/common/workspaces/terminating_a_workspace",
                ],
              },
            ],
            "Administrator View": [
              "user_guide/sidebar/common/dashboard/introduction",
              {
                Auth: ["user_guide/sidebar/admin/auth/introduction"],
                "Users & Roles": [
                  "user_guide/sidebar/admin/users/introduction",
                  "user_guide/sidebar/admin/users/user_roles",
                  "user_guide/sidebar/admin/users/add_federated_user",
                ],
                Accounts: [
                  {
                    Projects: [
                      "user_guide/sidebar/admin/accounts/projects/introduction",
                      "user_guide/sidebar/admin/accounts/projects/create_project",
                      "user_guide/sidebar/admin/accounts/projects/add_user_to_project",
                    ],
                    Indexes: [
                      "user_guide/sidebar/admin/accounts/indexes/introduction",
                      "user_guide/sidebar/admin/accounts/indexes/create_new_index",
                    ],
                    "AWS Accounts": [
                      "user_guide/sidebar/admin/accounts/aws_accounts/introduction",
                      "user_guide/sidebar/admin/accounts/aws_accounts/create_member_account",
                      "user_guide/sidebar/admin/accounts/aws_accounts/invite_member_account",
                      "user_guide/sidebar/admin/accounts/aws_accounts/set_account_budget",
                      {
                        "Roles and Permissions": [
                          "user_guide/sidebar/admin/accounts/aws_accounts/master_role",
                          "user_guide/sidebar/admin/accounts/aws_accounts/cross_account_execution_role",
                        ],
                      },
                    ],
                  },
                ],
                Workflows: ["user_guide/sidebar/admin/workflows/introduction"],
                Studies: [
                  "user_guide/sidebar/common/studies/introduction",
                  "user_guide/sidebar/common/studies/creating_a_study",
                  "user_guide/sidebar/common/studies/studies_page",
                  "user_guide/sidebar/common/studies/sharing_a_study",
                  "user_guide/sidebar/common/studies/data_sources",
                ],
                Workspaces: [
                  "user_guide/sidebar/common/workspaces/introduction",
                  "user_guide/sidebar/common/workspaces/create_workspace_study",
                  "user_guide/sidebar/common/workspaces/terminating_a_workspace",
                ],
              },
            ],
          },
        ],
      },
    ],
    "Best Practices": [
      "best_practices/introduction",
      "best_practices/multiple_deployment_environments",
      "best_practices/amazon_inspector",
      "best_practices/aws_cloudtrail",
      "best_practices/aws_shield",
      "best_practices/cicd",
      "best_practices/rotating_jwt_token",
    ],
    "Development Guide": [
      "development/introduction"
    ],
  },
};
