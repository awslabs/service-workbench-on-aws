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

const { iteratee } = require('lodash');
const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const LaunchProduct = require('../launch-product/launch-product');

describe('LaunchProduct', ()=> {
      const meta = {};
      const input = {};
    
      const lp = new LaunchProduct({
        step: { config: {} },
        workflowPayload: new WorkflowPayload({ meta, input, workflowInstance: { steps: [] } }),
      });

    // afterEach(() => {
    //     const resolvedInputParams = [];
    //     const datetime = 0;
    //     const datetime2 = 0;
    // })

    describe('checkNamespace', () => {
        it('Static name should be transformed to start with analysis- and end with number string and be unique between calls', async () => {
            // Build 
            const resolvedInputParams = [{Key: 'Namespace', Value: 'staticname'}];
            const datetime = Date.now();
            const resolvedInputParams2 = [{Key: 'Namespace', Value: 'staticname'}];
            const datetime2 = Date.now() + 1;
            const originalNamespace = resolvedInputParams[0].Value;
    
            // Operate
            const {namespaceParam, namespaceIndex } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);
            const {namespaceParam2, namespaceIndex2 } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams2, datetime2);
    
            // Check
            await expect(namespaceParam).not.toBe(namespaceParam2);
            await expect(namespaceParam).toBe('analysis-' + originalNamespace + `-${datetime}`);
        });
    
        it('Static name that begins with analysis- should be transformed to end with number string and be unique between calls', async () => {
            // Build
            const resolvedInputParams = [{Key: 'Namespace', Value: 'analysis-staticname'}];
            const resolvedInputParams2 = [{Key: 'Namespace', Value: 'analysis-staticname'}];
            const datetime = Date.now();
            const datetime2 = Date.now() + 1;
            const originalNamespace = resolvedInputParams[0].Value;
    
            // Operate
            const { namespaceParam, namespaceIndex } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);
            const { namespaceParam2, namespaceIndex2 } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams2, datetime2);
    
            // Check
            await expect(namespaceParam).not.toBe(namespaceParam2);
            await expect(namespaceParam).toBe(originalNamespace + `-${datetime}`);
        });
    
        it('Dynamic name should not be altered', async () => {
            // Build
            const datetime = Date.now();
            const resolvedInputParams = [{Key: 'Namespace', Value: `analysis-${datetime}`}];
    
            // Operate
            const { namespaceParam, namespaceIndex } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);
    
            // Check
            await expect(namespaceParam).toBe(resolvedInputParams[namespaceIndex].Value);
        });
    
        it('Static name that ends with a number sequence should be transformed to start with analysis- and end with number string that is unique and be unique between calls', async () => {
            // Build
            const resolvedInputParams = [{Key: 'Namespace', Value: 'staticname-2626262626'}];
            const resolvedInputParams2 = [{Key: 'Namespace', Value: 'staticname-2626262626'}];
            const datetime = Date.now();
            const datetime2 = Date.now() + 1;
            const originalNamespace = resolvedInputParams[0].Value;
    
            // Operate
            const { namespaceParam, namespaceIndex } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);
            const { namespaceParam2, namespaceIndex2 } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams2, datetime2);
    
            // Check
            await expect(namespaceParam).not.toBe(namespaceParam2);
            await expect(namespaceParam).toBe('analysis-' + originalNamespace + `-${datetime}`);
        });

        it('Static name that ends with a datetime string should be transformed to start with analysis-', async () => {
            // Build
            const datetime = Date.now();
            const resolvedInputParams = [{Key: 'Namespace', Value: `staticname-${datetime}`}];
            const originalNamespace = resolvedInputParams[0].Value;
    
            // Operate
            const { namespaceParam, namespaceIndex } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);
    
            // Check
            // const afterNamespace = after[0];
            await expect(namespaceParam).toBe('analysis-' + originalNamespace);
        });

        it('getNamespaceAndIndexIfNecessary does not change the original resolvedInputParams array when the namespace is static', async () => {
            // Build
            const datetime = Date.now();
            const resolvedInputParams = [{Key: 'Namespace', Value: 'staticname'}];

            // Operate
            const { namespaceParam, namespaceIndex } = await lp.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);

            // Check
            // const afterNamespace = after[0];
            // const afterIndex = after[1];
            await expect(namespaceParam).not.toBe(resolvedInputParams[namespaceIndex]);
        })
    })
})
