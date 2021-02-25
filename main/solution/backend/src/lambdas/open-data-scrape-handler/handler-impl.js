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
// 1. Get and parse yaml files from aws open data
// 2. Filter for the desired tags
// 3. Write to study-service
//
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const consoleLogger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
};

const _ = require('lodash');
let fetch = require('node-fetch');
const yaml = require('js-yaml');

const studyCategory = 'Open Data';

// Webpack messes with the fetch function import and it breaks in lambda.
if (typeof fetch !== 'function' && fetch.default && typeof fetch.default === 'function') {
  fetch = fetch.default;
}

const newHandler = async ({ studyService, log = consoleLogger } = {}) => {
  const scrape = {
    githubApiUrl: 'https://api.github.com',
    rawGithubUrl: 'https://raw.githubusercontent.com',
    owner: 'awslabs',
    repository: 'open-data-registry',
    ref: 'main',
    subtree: 'datasets',
    filterTags: [
      'genetic',
      'genomic',
      'life sciences',
      'whole genome sequencing',
      'STRIDES',
      'cancer',
      'population genetics',
      'COVID-19',
      'health',
      'neuroimaging',
      'neuroscience',
      'cell biology',
      'cell imaging',
      'bioinformatics',
    ],
  };

  function normalizeValue(value) {
    if (_.isArray(value)) {
      return value.map(normalizeValue);
    }
    if (_.isObject(value)) {
      return normalizeKeys(value);
    }
    return value;
  }

  function normalizeKeys(obj) {
    const normalized = Object.entries(obj).reduce((result, [key, value]) => {
      // lowercase the first letter of the words in the key, unless the whole word is uppercase
      // in which case lowercase the entire word
      const normalizedKey = key
        .split(' ')
        .map(word => (/^[A-Z]*$/.test(word) ? word.toLowerCase() : `${word.slice(0, 1).toLowerCase()}${word.slice(1)}`))
        .join(' ');
      const normalizedValue = normalizeValue(value);
      return { ...result, [normalizedKey]: normalizedValue };
    }, {});

    return normalized;
  }

  async function fetchDatasetFiles() {
    const { githubApiUrl, rawGithubUrl, owner, repository, ref, subtree } = scrape;

    log.info(`Fetching ${owner}/${repository}/${ref}/${subtree} file list`);
    const refResponse = await fetch(`${githubApiUrl}/repos/${owner}/${repository}/git/refs/heads/${ref}`);

    if (!refResponse.ok) {
      throw new Error('Failed to fetch git refs');
    }

    const {
      object: { url: commitUrl },
    } = await refResponse.json();

    const commitResponse = await fetch(commitUrl);

    if (!commitResponse.ok) {
      throw new Error('Failed to fetch git commit');
    }

    const {
      tree: { url: treeUrl },
    } = await commitResponse.json();

    const baseTreeResponse = await fetch(treeUrl);

    if (!baseTreeResponse.ok) {
      throw new Error('Failed to fetch base git tree');
    }

    const { tree: baseTree } = await baseTreeResponse.json();

    // The tree is an array of entries like:
    // {
    //   path: 'datasets',
    //   mode: '040000',
    //   type: 'tree',
    //   sha: '82e29cc3cd11cdfedfbcfc756d132414f95dc8c2',
    //   url:
    //    'https://api.github.com/repos/awslabs/open-data-registry/git/trees/82e29cc3cd11cdfedfbcfc756d132414f95dc8c2'
    // }
    // Find and list the datasets tree, fetching all content
    const datasetsDir = baseTree.find(({ path: p }) => p === subtree);

    if (!(datasetsDir && datasetsDir.url)) {
      throw new Error('Failed to find the datasets directory');
    }

    const datasetsTreeResponse = await fetch(datasetsDir.url);

    if (!datasetsTreeResponse.ok) {
      throw new Error('Failed to fetch datasets git tree');
    }

    const { tree } = await datasetsTreeResponse.json();

    const blobs = tree.filter(({ type }) => type === 'blob');

    const rawContentUrls = blobs.map(({ path, sha }) => ({
      id: path.replace('.yaml', ''),
      sha,
      url: `${rawGithubUrl}/${owner}/${repository}/${ref}/${subtree}/${path}`,
    }));

    return rawContentUrls;
  }

  async function fetchFile({ url, id, sha }) {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    const text = await res.text();

    const doc = yaml.safeLoad(text, { filename: url });

    return normalizeKeys({ ...doc, id, sha });
  }

  function basicProjection({ id, sha, name, description, resources }) {
    return {
      id,
      name,
      description,
      category: studyCategory,
      sha,
      resources: resources.map(({ arn }) => ({ arn })),
    };
  }

  return async () => {
    const fileUrls = await fetchDatasetFiles();
    const opendata = await fetchOpenData({ fileUrls, requiredTags: scrape.filterTags, log, fetchFile });

    const simplified = opendata.map(basicProjection);

    log.info('Updating studies');
    // create or update existing record
    const userContext = getSystemRequestContext();
    await Promise.all(
      simplified.map(async study => {
        // studyService.find returns the entire db row for that study id
        const existingStudy = await studyService.find(userContext, study.id);
        if (!existingStudy) {
          await studyService.create(userContext, study);
        } else {
          // remove additional properties before update call to match jsonSchemaValidation
          const studyToUpdate = _.omit(existingStudy, ['updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'category']);

          await studyService.update(userContext, studyToUpdate);
        }
      }),
    );

    return simplified;
  };
};

const fetchOpenData = async ({ fileUrls, requiredTags, log, fetchFile }) => {
  log.info(`Fetching ${fileUrls.length} metadata files`);
  const metadata = await Promise.all(fileUrls.map(fetchFile));

  log.info(`Filtering for ${requiredTags} tags and resources with valid ARNs`);
  const validS3Arn = new RegExp(/^arn:aws:s3:.*:.*:.+$/);
  const filtered = metadata.filter(({ tags, resources }) => {
    return (
      requiredTags.some(filterTag => tags.includes(filterTag)) &&
      resources.every(resource => {
        return resource.type === 'S3 Bucket' && validS3Arn.test(resource.arn);
      })
    );
  });

  return filtered;
};

module.exports = {
  fetchOpenData,
  newHandler,
};
