# Addon for Environment Types Management APIs

This add-on introduces the rest APIs for management of analytics environment types functionality. 
The addon uses AWS Service Catalog and provides APIs to import specific AWS Service Catalog Product/Version combination 
as an environment type.  

## Key Terms

**Environment Type:** Type of analytics environment that can be launched later by users. E.g., EMR, SageMaker etc. Each environment type maps to a specific product version in AWS Service Catalog
 
**Environment Type Candidate:** AWS Service Catalog Product/Version combination that is candidate for importing into the system as an environment type

**Environment Type Configuration:** Predefined set of AWS CloudFormation Input Parameter values for the AWS Service Catalog Product Version. These configurations are available as preset options for the user when launching environments of a given environment type.
 
**Environment Type Configuration Variables:** Creation of **Environment Type Configuration** requires specifying mapping between AWS CloudFormation Input Parameters and predefined values. Many times, the values are not available at the time of creating this mapping. In such cases, a variable expression in the form of **${variableName}** can be specified in place of the value. The *Environment Type Configuration Variables* denote all such variables that can be referenced in the variable expressions.

**Environment Type Status:** Once a specific AWS Service Catalog Product/Version combination is imported in the system as an environment type. By default, it gets imported in **non-approved** status. At this point, the environment type is not available to regular users. Admins can test the environment and then approve it for usage. The environment type status then changes to **approved**. 

## npm packages

- @aws-ee/environment-type-mgmt-api
- @aws-ee/environment-sc-workflow-steps
- @aws-ee/environment-sc-workflows

## Runtime extension points
- New
    - 'env-provisioning'

- Used
    - 'services'
    - 'routes'

## REST APIs
### Environment Type Candidates APIs
(uses AWS Service Catalog -- interacts after assuming the EnvMgmtRole that gets created via CloudFormation template)

**GET /api/workspace-type-candidates**: Lists various environment type candidates. By default, it returns only "not-imported" environment type candidates i.e., the environment type candidates that are accessible via the EngMgmtRole but not yet imported. Takes optional "status" query string parameter to return environment type candidates with specific status. Valid values for status param are "\*" (include all env type candidates), or "not-imported" (or a comma separated value). Similarly, by default the API returns only the latest versions of AWS Service Catalog Products as environment type candidates. To include all versions an optional query string parameter "version" can be passed. Value values are "\*" or "latest". Also, incorporated the portfolio id in the response object.

### Environment Type APIs
(uses DynamoDB for persistence)

**GET /api/workspace-types**: Lists various environment types. By default, it returns only "approved" environment types. Takes optional "status" query string parameter to return environment types with specific status. Valid values for status param are "\*" (include all env types), "not-approved", or "approved" (or a comma separated value)
 
**GET /api/workspace-types/{id}**: Returns a specific environment type identified by the **{id}** path parameter

**POST /api/workspace-types**: Creates (imports) an environment type 

**PUT /api/workspace-types/{id}**: Updates an existing environment type identified by the **{id}** path parameter

**PUT /api/workspace-types/{id}/approve**: Approves an existing environment type identified by the **{id}** path parameter for general usage by other users

**PUT /api/workspace-types/{id}/revoke**: Revokes the approval of an existing environment type identified by the **{id}** path parameter

**DELETE /api/workspace-types/{id}**: Deletes an existing environment type identified by the **{id}** path parameter

### Environment Type Configuration APIs
(uses S3 for persistence)

**GET /api/workspace-types/{envTypeId}/configurations**: Lists environment type configurations for the given environment type identified by **{envTypeId}** path param

**GET /api/workspace-types/{envTypeId}/configurations/{configId}**: Returns environment type configuration identified by **{configId}** for the given environment type identified by **{envTypeId}** path param

**POST /api/workspace-types/{envTypeId}/configurations**: Creates (configures) new environment type configuration for the given environment type identified by **{envTypeId}** path param

**PUT /api/workspace-types/{envTypeId}/configurations/{configId}**: Updates an existing environment type configuration identified by **{configId}** for the given environment type identified by **{envTypeId}** path param

**DELETE /api/workspace-types/{envTypeId}/configurations/{configId}**: Deletes an existing environment type configuration identified by **{configId}** for the given environment type identified by **{envTypeId}** path param

### Environment Type Configuration Variables APIs

**GET /api/workspace-types/{envTypeId}/config-vars/**: Lists environment type configuration variables for the given environment type identified by **{envTypeId}** path param. This API is plugins driven and internally it gathers all variables provided by various plugins using the plugin method **add** for extension point named **env-provisioning**  

## Dependencies

- addon-base
- addon-base-rest-api
