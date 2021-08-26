import * as cdk from '@aws-cdk/core';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecspatterns from '@aws-cdk/aws-ecs-patterns';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Peer, Port } from '@aws-cdk/aws-ec2'; 


export class AwsInfrastructureBuild extends cdk.Stack {

    vpc: Vpc;
    repoName: string;
  
    constructor(scope: cdk.Construct, id: string, vpc: Vpc, repoName: string, props?: cdk.StackProps) {
      super(scope, id, props);
    
      this.vpc = vpc;
      this.repoName = repoName;

    }


    public createFargateService() {

      const securityGroup = new SecurityGroup(this, 'mySecurityGroup', {
        vpc: this.vpc,
        description: 'Allow port to connect to EC2',
        allowAllOutbound: true
      });
  
      securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(9000), 'Allows internet to send request')
      
      var cluster = new Cluster(this, 'PayslipCluster', {
        clusterName: 'PayslipCluster',
        vpc: this.vpc
      });
  
      var fargateService = new ecspatterns.ApplicationLoadBalancedFargateService(this, 'PayslipService', {
        serviceName: 'PayslipService',
        cluster: cluster,
        memoryLimitMiB: 512,
        cpu: 256,
        desiredCount: 1,
        assignPublicIp: true,
        securityGroups: [securityGroup],
        listenerPort: 8080,
        publicLoadBalancer: true,
        taskImageOptions: {
          containerName: this.repoName,
          image: ecs.ContainerImage.fromRegistry("837684165413.dkr.ecr.us-east-2.amazonaws.com/"+this.repoName+":latest"),
          //image: ecs.ContainerImage.fromRegistry("timxii/monthlypayslip"),
          containerPort: 8080, 
        },
      });

      fargateService.taskDefinition.executionRole?.addManagedPolicy((ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')));

      fargateService.targetGroup.configureHealthCheck({
        path: "/health",
        healthyHttpCodes: "200",
        port: "9000"
      })

      return fargateService.service;
    }

}
