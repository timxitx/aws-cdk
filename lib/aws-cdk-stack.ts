import * as cdk from '@aws-cdk/core';
import { AwsInfrastructureBuild } from "./aws-infrastructure-build";
import { AwsCodepipeline } from './aws-codepipeline';
import { Vpc } from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';

const repoName = "monthly-payslip-with-cdk";
 
export class AwsCdkStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = new Vpc(this, "MyVpc", {
      maxAzs: 3 // Default is all AZs in region
    });

    var infrastructure_build = new AwsInfrastructureBuild(this, "AwsInfrastructureBuild", vpc, repoName, props);
    var aws_piepleine = new AwsCodepipeline(this, "AwsCodepipeline", vpc, repoName, props);
    var service = infrastructure_build.createFargateService();
    aws_piepleine.addFargateService(service);
    aws_piepleine.build();


  }
  
}
