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

//
// 1. Get Open Source metadata
// 2. Filter for the desired tags
// 3. Write to study-service
//
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const _ = require('lodash');
const { normalizeKeys, basicProjection } = require('./utilities');

const consoleLogger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
  error(...args) {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};

const studyCategory = 'Open Data';

const newHandler = async ({ S3, studyService, openDataTagFilters, log = consoleLogger } = {}) => {
  return async () => {
    const simplifiedStudyData = await getOpenDataMetadata(S3, openDataTagFilters, log);
    return saveOpenData(log, simplifiedStudyData, studyService);
  };
};

async function saveOpenData(log, simplified, studyService) {
  log.info('Updating studies');
  // create or update existing record
  const userContext = getSystemRequestContext();
  await Promise.all(
    simplified.map(async study => {
      try {
        const existingStudy = await studyService.find(userContext, study.id);
        if (!existingStudy) {
          await studyService.create(userContext, study);
        } else {
          await studyService.update(userContext, { rev: existingStudy.rev, ..._.omit(study, 'category') });
        }
        // Catch the err here so other open data update could continue
      } catch (err) {
        log.error(`Error updating study for id ${study.id} and name ${study.name}. See error and study data below: `);
        log.error(err);
        log.error(study);
      }
    }),
  );
  return simplified;
}

async function getOpenDataMetadata(S3, openDataTagFilters, log) {
  const getObjResponse = await S3.getObject({
    Bucket: 'registry.opendata.aws',
    Key: 'roda/ndjson/index.ndjson',
  }).promise();

  const allMetaData = getObjResponse.Body.toString('utf-8')
    .split('\n')
    .filter(metadata => {
      return metadata !== '';
    })
    .map(metadata => {
      const md = JSON.parse(metadata);
      return normalizeKeys({ ...md, id: md.Slug });
    });

  log.info(`Filtering for ${openDataTagFilters} tags and resources with valid ARNs`);
  const validS3Arn = new RegExp(/^arn:aws:s3:.*:.*:.+$/);
  const filtered = allMetaData.filter(({ tags, resources }) => {
    return (
      openDataTagFilters.some(filterTag => tags.includes(filterTag)) &&
      resources.every(resource => {
        return resource.type === 'S3 Bucket' && validS3Arn.test(resource.arn);
      })
    );
  });

  return filtered.map(metadata => {
    return basicProjection({ ...metadata, studyCategory });
  });
}

module.exports = {
  getOpenDataMetadata,
  newHandler,
  saveOpenData,
};
