# CDK Construct: StaticWebsite

CDK Construct Library containing the `StaticWebsite` construct. It can be used to easily generate
all the necessary infrastructure components required by a typical S3/CloudFront backed Website.

WAF support: The construct allows you to link the website to a WAF by referencing the WAF ARN.

## How to use

    new StaticWebsite(this, "static-website", {
      domainName,
      websiteDistPath,
    });

Creates an S3 bucket and uploads the files at `websiteDistPath` to it. Exposes the S3 bucket via
a CloudFront distribution. Creates a DNS record for `domainName` so that the site is associated with
that. Finally, creates and associates an SSL certificate with the domain/distribution.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
