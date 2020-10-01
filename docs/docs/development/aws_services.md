---
id: aws_services
title: AWS Services
sidebar_label: AWS Services
---

## AWS Services

This section describes some of the AWS services used by Galileo.  The resource names usually include the :ref:`namespace` including the stage name used at deployment, so you can deploy multiple instances of Galileo from the same account if you use a different stage name for each deployment.

---------------------
EC2
---------------------

EC2 is used only as a platform from which to deploy Galileo.  For more details see :ref:`deployment_instance`


.. _aws_service_iam:

---------------------
IAM
---------------------

Galileo creates several roles in your account. The role ``<namespace>-prep-raas-master-MasterRole-XXX`` is created when you run the :ref:`post_deployment` SDC.  This role has as Trust Relationship to trust the Main account from which you deploy Galileo, and two Policies allowing that account to assume a role in this Master account (see :ref:`account_structure`).

|pic1|  |pic2|

.. |pic1| image:: img/iam_role_00.jpg
   :width: 45%
   :class: with-border

.. |pic2| image:: img/iam_role_01.jpg
   :width: 45%
   :class: with-border

Associated with the role is an `External ID`_.  This is an identifying string provided when the role is created.  In order for the Trusted Entity (your Main account) to assume role into the Master Account, it must supply this External ID.  This provides a lightweight means of establishing a revokable relationship.  

In the current Galileo deployment, the External ID is configured as a default value in ``main/solution/prepare-master-acc/config/settings/.defaults.yml`` and it is the string **galileo**.  To change this value, create a stage-named configuration file (``mystagename.yml``) in the same directory (see :ref:`configuration`)

.. image:: img/iam_role_02.jpg
   :width: 400
   :align: center
   :class: with-border

.. _External ID: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html

.. _aws_service_organizations:

---------------------
Organizations
---------------------

An AWS Organization is created in the :ref:`Master Account<account_structure>`.  This Organization will have an account created for each deployment from this account; the name of the account is the stage name used.

.. image:: img/organizations_01.jpg
   :width: 600
   :align: center
   :class: with-border

.. _aws_service_s3:

---------------------
S3
---------------------

Multiple S3 buckets are created by Galileo.  Filtering by stage name shows the buckets for a deployment.

.. image:: img/s3_00.jpg
   :width: 450
   :align: center
   :class: with-border

The 'studydata' bucket contains all the data for the various :ref:`studies` in this deployment at the individual and organization level.

.. image:: img/s3_01.jpg
   :width: 400
   :align: center
   :class: with-border
