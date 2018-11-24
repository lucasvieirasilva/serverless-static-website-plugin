'use strict';

const spawnSync = require('child_process').spawnSync;

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      syncToS3: {
        usage: 'Deploys the `s3LocalPath` directory to your bucket',
        lifecycleEvents: [
          'sync',
        ],
      },
      bucketInfo: {
        usage: 'Fetches and prints out the deployed CloudFront bucket names',
        lifecycleEvents: [
          'bucketInfo',
        ],
      },
      domainInfo: {
        usage: 'Fetches and prints out the deployed CloudFront domain names',
        lifecycleEvents: [
          'domainInfo',
        ],
      },
      invalidateCloudFrontCache: {
        usage: 'Invalidates CloudFront cache',
        lifecycleEvents: [
          'invalidateCache',
        ],
      },
    };

    this.hooks = {
      'before:remove:remove': this.emptyBucket.bind(this),
      'aws:deploy:finalize:cleanup': this.deploy.bind(this),
      'syncToS3:sync': this.syncDirectory.bind(this),
      'domainInfo:domainInfo': this.domainInfo.bind(this),
      'bucketInfo:bucketInfo': this.bucketInfo.bind(this),
      'invalidateCloudFrontCache:invalidateCache': this.invalidateCache.bind(
        this,
      ),
    };
  }

  getDescribeStacksOutput(outputKey) {
    const provider = this.serverless.getProvider('aws');
    const stackName = provider.naming.getStackName(this.options.stage);
    return provider
      .request(
        'CloudFormation',
        'describeStacks', {
          StackName: stackName
        },
        this.options.stage,
        this.options.region // eslint-disable-line comma-dangle
      )
      .then((result) => {
        const outputs = result.Stacks[0].Outputs;
        const output = outputs.find(entry => entry.OutputKey === outputKey);
        return output.OutputValue;
      });
  }

  async emptyBucket() {
    const s3Bucket = await this.getDescribeStacksOutput('WebAppS3BucketOutput');
    const args = [
      's3',
      'rm',
      `s3://${s3Bucket}/`,
      '--recursive'
    ];

    this.serverless.cli.log(args);
    const { stdout, sterr } = this.runAwsCommand(args);
    this.serverless.cli.log(stdout || 'stdoud undefined');
    this.serverless.cli.log(sterr || 'stderr undefined');
    if (!sterr) {
      this.serverless.cli.log('Successfully synced to the S3 bucket');
    }
  }

  // syncs the `app` directory to the provided bucket
  async syncDirectory() {
    const s3Bucket = await this.getDescribeStacksOutput('WebAppS3BucketOutput');
    const s3LocalPath = this.serverless.variables.service.custom.s3LocalPath;
    const args = [
      's3',
      'sync',
      s3LocalPath,
      `s3://${s3Bucket}/`,
      '--delete'
    ];
    this.serverless.cli.log(args);
    const { stdout, sterr } = this.runAwsCommand(args);
    this.serverless.cli.log(stdout || 'stdoud undefined');
    this.serverless.cli.log(sterr || 'stderr undefined');
    if (!sterr) {
      this.serverless.cli.log('Successfully synced to the S3 bucket');
    }
  }

  // fetches the bucket name from the CloudFront outputs and prints it out
  async bucketInfo() {
    const outputValue = await this.getDescribeStacksOutput('WebAppS3BucketOutput');

    this.serverless.cli.log(`Web App Bucket: ${outputValue || 'Not Found'}`);
  }

  // fetches the domain name from the CloudFront outputs and prints it out
  async domainInfo() {
    const outputValue = await this.getDescribeStacksOutput('WebAppCloudFrontDistributionOutput');
    this.serverless.cli.log(`Web App Domain: ${outputValue || 'Not Found'}`);

    return outputValue;
  }

  async deploy() {
    await this.syncDirectory();
    await this.invalidateCache();
  }

  runAwsCommand(args) {
    const result = spawnSync('aws', args);
    const stdout = result && result.stdout && result.stdout.toString();
    const sterr = result && result.stderr && result.stderr.toString();

    return {stdout, sterr};
  }

  async invalidateCache() {
    const provider = this.serverless.getProvider('aws');

    const domain = await this.domainInfo();

    const result = await provider.request(
      'CloudFront',
      'listDistributions', {},
      this.options.stage,
      this.options.region,
    );

    const distributions = result.DistributionList.Items;
    const distribution = distributions.find(
      entry => entry.DomainName === domain,
    );

    if (distribution) {
      this.serverless.cli.log(
        `Invalidating CloudFront distribution with id: ${distribution.Id}`,
      );
      const args = [
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        distribution.Id,
        '--paths',
        '/*',
      ];
      const {
        sterr
      } = this.runAwsCommand(args);
      if (!sterr) {
        this.serverless.cli.log('Successfully invalidated CloudFront cache');
      } else {
        throw new Error('Failed invalidating CloudFront cache');
      }
    } else {
      const message = `Could not find distribution with domain ${domain}`;
      const error = new Error(message);
      this.serverless.cli.log(message);
      throw error;
    }
  }
}

module.exports = ServerlessPlugin;
