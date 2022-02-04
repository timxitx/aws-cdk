import * as cdk from '@aws-cdk/core';
import { AwsInfrastructureBuild } from "./aws-infrastructure-build";
import { AwsCodepipeline } from './aws-codepipeline';
import { Vpc } from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';

const repoName = "payslip-repository";
 
export class AwsCdkStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = new Vpc(this, "MyVpc", {
      maxAzs: 2, // Default is all AZs in region
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    var ecrRepository = new ecr.Repository(this, repoName, {
      repositoryName: repoName
    });

    var infrastructure_build = new AwsInfrastructureBuild(this, "AwsInfrastructureBuild", vpc, repoName, props);
    var aws_piepleine = new AwsCodepipeline(this, "AwsCodepipeline", vpc, repoName, ecrRepository, props);
    var service = infrastructure_build.createFargateService();
    aws_piepleine.addFargateService(service);
    aws_piepleine.build();


  }
  
}
