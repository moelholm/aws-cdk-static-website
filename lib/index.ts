import * as cdk from "@aws-cdk/core";
import { Bucket, BlockPublicAccess } from "@aws-cdk/aws-s3";
import {
  Source,
  BucketDeployment,
  CacheControl,
} from "@aws-cdk/aws-s3-deployment";
import {
  CloudFrontWebDistribution,
  OriginAccessIdentity,
} from "@aws-cdk/aws-cloudfront";
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from "@aws-cdk/aws-route53";
import { CloudFrontTarget } from "@aws-cdk/aws-route53-targets";
import { DnsValidatedCertificate } from "@aws-cdk/aws-certificatemanager";

export interface StaticWebsiteProps {
  /**
   * Fully qualified domain name of the website.
   */
  domainName: string;
  /**
   * Local filesystem path to the website files that will be uploaded to S3.
   *
   * @default None (The bucket will be empty)
   */
  websiteDistPath?: string;
  /**
   * S3 bucket default website document.
   *
   * @default index.html
   */
  indexDocument?: string;
  /**
   * S3 bucket name.
   *
   * @default website.${domainName}
   */
  bucketName?: string;
  /**
   * ID of a Web Application Firewall (WAFv2) to associate with the Website.
   *
   * @default None
   */
  webACLId?: string;
}

/**
 * Creates a static website hosted by S3.
 *
 * Detailed actions, taken by this construct:
 * - An S3 bucket is created and Web site files, if any, are uploaded to it
 * - The S3 bucket is proxied by a CloudFront distribution
 * - A DNS "A" record is associated with the distribution
 * - An SSL certificate is issued to the domain name
 */
export class StaticWebsite extends cdk.Construct {
  public readonly bucket: Bucket;
  public readonly bucketDeployment?: BucketDeployment;
  public readonly distribution: CloudFrontWebDistribution;
  public readonly dnsRecord: ARecord;

  constructor(scope: cdk.Construct, id: string, props: StaticWebsiteProps) {
    super(scope, id);
    // Extract configuration
    const {
      websiteDistPath,
      domainName,
      bucketName = `website.${domainName}`,
      indexDocument = "index.html",
      webACLId,
    } = props;
    // Bucket containing the static website
    this.bucket = this.createBucket(indexDocument, bucketName);
    // ZIP file or directory containing the website files (will be uploaded to S3)
    if (websiteDistPath) {
      this.bucketDeployment = this.createBucketDeployment(
        websiteDistPath,
        this.bucket
      );
    }
    // Create SSL certificate
    const hostedZone = this.lookupHostedZone(domainName);
    const certificate = this.createCertificate(domainName, hostedZone);
    // CloudFront distribution config
    this.distribution = this.createCloudFrontWebDistribution(
      this.bucket,
      this.createOriginAccessIdentity(this.bucket),
      certificate.certificateArn,
      domainName,
      indexDocument,
      webACLId
    );
    // DNS record establishing the link from the domain to the CloudFront distribution
    this.dnsRecord = this.createARecord(
      hostedZone,
      domainName,
      this.distribution
    );
  }

  private createBucket(websiteIndexDocument: string, bucketName: string) {
    return new Bucket(this, "S3Bucket", {
      websiteIndexDocument,
      bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
  }

  private createBucketDeployment(
    websiteDistPath: string,
    destinationBucket: Bucket
  ) {
    return new BucketDeployment(this, "BucketDeployment", {
      sources: [Source.asset(websiteDistPath)],
      destinationBucket,
      cacheControl: [CacheControl.noCache()],
    });
  }

  private createOriginAccessIdentity(destinationBucket: Bucket) {
    const originAccessIdentity = new OriginAccessIdentity(this, "Oai", {
      comment: `OAI for ${destinationBucket.bucketName}`,
    });
    destinationBucket.grantRead(originAccessIdentity.grantPrincipal);
    return originAccessIdentity;
  }

  private createCloudFrontWebDistribution(
    destinationBucket: Bucket,
    originAccessIdentity: OriginAccessIdentity,
    certificatArn: string,
    domainName: string,
    websiteIndexDocument: string,
    webACLId?: string
  ) {
    return new CloudFrontWebDistribution(this, "CloudfrontDistribution", {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: destinationBucket,
            originAccessIdentity,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              defaultTtl: cdk.Duration.days(60),
            },
          ],
        },
      ],
      webACLId,
      aliasConfiguration: {
        acmCertRef: certificatArn,
        names: [domainName],
      },
      defaultRootObject: websiteIndexDocument,
      errorConfigurations: [
        {
          errorCode: 404,
          errorCachingMinTtl: 300,
          responseCode: 200,
          responsePagePath: `/${websiteIndexDocument}`,
        },
      ],
    });
  }

  private createCertificate(domainName: string, hostedZone: IHostedZone) {
    return new DnsValidatedCertificate(this, "SslCertificate", {
      domainName: domainName,
      hostedZone: hostedZone,
      region: "us-east-1",
    });
  }

  private lookupHostedZone(domainName: string) {
    const hostedZoneDomainName = domainName.replace(/.*?\.(.*)/, "$1");
    return HostedZone.fromLookup(this, "HostedZone", {
      domainName: hostedZoneDomainName,
    });
  }

  private createARecord(
    zone: IHostedZone,
    domainName: string,
    distribution: CloudFrontWebDistribution
  ) {
    return new ARecord(this, "DnsARecord", {
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: domainName,
      ttl: cdk.Duration.minutes(1),
      zone,
    });
  }
}
