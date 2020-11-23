import { expect as expectCDK, haveResource } from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import { StaticWebsite } from "../lib/index";

const createTestStack = () =>
  new cdk.Stack(new cdk.App(), "TestStack", {
    env: {
      account: "123123123",
      region: "eu-west-1",
    },
  });

test("Creates S3 bucket", () => {
  // Given
  const stack = createTestStack();
  // When
  new StaticWebsite(stack, "test", {
    domainName: "foo.bar.dk",
  });
  // Then
  expectCDK(stack).to(
    haveResource("AWS::S3::Bucket", {
      BucketName: "website.foo.bar.dk",
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      WebsiteConfiguration: {
        IndexDocument: "index.html",
      },
    })
  );
});

test("Creates DNS record", () => {
  // Given
  const stack = createTestStack();
  // When
  new StaticWebsite(stack, "test", {
    domainName: "foo.bar.dk",
  });
  // Then
  expectCDK(stack).to(
    haveResource("AWS::Route53::RecordSet", {
      Name: "foo.bar.dk.",
      Type: "A",
    })
  );
});

test("Creates CloudFront distribution", () => {
  // Given
  const stack = createTestStack();
  // When
  new StaticWebsite(stack, "test", {
    domainName: "foo.bar.dk",
  });
  // Then
  expectCDK(stack).to(haveResource("AWS::CloudFront::Distribution"));
  expectCDK(stack).to(
    haveResource("AWS::CloudFront::CloudFrontOriginAccessIdentity")
  );
});
