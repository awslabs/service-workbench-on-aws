# Infrastructure Tests for SWB
This test suite checks if the hosting account Cloudformation stack is set up with the correct security settings. Tests were added 
to ensure that if AppStream and Egress are enabled, the stack does not have subnets and security group with internet connectivity.

# Prerequisites
Create a `config` file at `main/infrastructures-tests/config/settings/<STAGE>.yml`. You can use `main/infrastructures-tests/config/settings/example.yml` as 
an example.

# Running tests
After the config file is created, you can run the command below in `main/infrastructures-tests/` directory to start your tests.

`pnpm run testAppStreamEgressEnabled -- --stage=<STAGE>`