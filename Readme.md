# Serverless Static Website Plugin

## Install

```shellscript
npm i --save-dev serverless-static-website-plugin
```

## Usage

In `serverless.yml` add plugin declaration.

```yaml
plugins:
  - serverless-static-website-plugin
```

Add local path for deploy to S3.

```yaml
custom:
  s3LocalPath: dist/front-end
```

Add resources.

```yaml
resources:
  Resources:
    WebAppS3Bucket:
      Type: AWS::S3::Bucket
      Properties:
        AccessControl: PublicRead
        WebsiteConfiguration:
          IndexDocument: index.html
          ErrorDocument: index.html

    WebAppS3BucketPolicy:
      Type: AWS::S3::BucketPolicy
      Properties:
        Bucket:
          Ref: WebAppS3Bucket
        PolicyDocument:
          Statement:
            - Sid: PublicReadGetObject
              Effect: Allow
              Principal: "*"
              Action:
                - s3:GetObject
              Resource: 
                Fn::Join: [
                  "", [
                    "arn:aws:s3:::",
                    { "Ref": "WebAppS3Bucket" },
                    "/*"
                  ]
                ]
              
    WebAppCloudFrontDistribution:
      Type: AWS::CloudFront::Distribution
      Properties:
        DistributionConfig:
          Origins:
            - DomainName:
                Fn::Join: [
                  "", [
                    { "Ref": "WebAppS3Bucket" },
                    ".s3.amazonaws.com"
                  ]
                ]
              Id: WebApp
              CustomOriginConfig:
                HTTPPort: 80
                HTTPSPort: 443
                OriginProtocolPolicy: https-only
          Enabled: true
          DefaultRootObject: index.html
          CustomErrorResponses:
            - ErrorCode: 404
              ResponseCode: 200
              ResponsePagePath: /index.html
          DefaultCacheBehavior:
            AllowedMethods:
              - DELETE
              - GET
              - HEAD
              - OPTIONS
              - PATCH
              - POST
              - PUT
            TargetOriginId: WebApp
            ForwardedValues:
              QueryString: true
              Cookies:
                Forward: none
            ViewerProtocolPolicy: redirect-to-https
          PriceClass: PriceClass_100
          ViewerCertificate:
            CloudFrontDefaultCertificate: 'true'

  Outputs:
    WebAppS3BucketOutput:
      Value:
        'Ref': WebAppS3Bucket
    WebAppCloudFrontDistributionOutput:
      Value:
        'Fn::GetAtt': [ WebAppCloudFrontDistribution, DomainName ]
```

## Deploy

Deploy website to AWS (S3+CloudFront).

```shellscript
serverless deploy
```

## Aditional Command Lines

Only sync files to S3.

```shellscript
serverless syncToS3
```

Get bucket information.

```shellscript
serverless bucketInfo
```

Get CloudFront domain information.

```shellscript
serverless domainInfo
```

Only invalidate CloudFront Cache

```shellscript
serverless invalidateCloudFrontCache
```

## Remove

To remove environment

```shellscript
serverless remove
```