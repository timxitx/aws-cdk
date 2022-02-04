import * as cdk from '@aws-cdk/core';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2';
import * as ecs from "@aws-cdk/aws-ecs";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecspatterns from '@aws-cdk/aws-ecs-patterns';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Peer, Port, InterfaceVpcEndpoint } from '@aws-cdk/aws-ec2'; 
import { Duration } from '@aws-cdk/core';


export class AwsInfrastructureBuild extends cdk.Stack {

    vpc: Vpc;
    repoName: string;
  
    constructor(scope: cdk.Construct, id: string, vpc: Vpc, repoName: string, props?: cdk.StackProps) {
      super(scope, id, props);
    
      this.vpc = vpc;
      this.repoName = repoName;

    }


    public createFargateService() {

      const securityGroup = new SecurityGroup(this, 'my-sg', {
        vpc: this.vpc,
        description: 'the security group for the application',
        allowAllOutbound: true
      });

      const securityGroupL= new SecurityGroup(this, 'sg-lambda', {
        vpc: this.vpc,
        description: 'the security group for lambda function',
        allowAllOutbound: true
      });

      securityGroup.connections.allowFrom(securityGroupL, Port.tcp(8080), 'all traffic from port 8080 for HTTP');
      //securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(8080), 'Allows internet to send request')

      new InterfaceVpcEndpoint(this, 'VPC Endpoint', {
        vpc: this.vpc,
        service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
        securityGroups: [securityGroup],
        privateDnsEnabled: true,
        subnets: this.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE
      })
      });
      
      var cluster = new Cluster(this, 'PayslipCluster', {
        clusterName: 'PayslipCluster',
        vpc: this.vpc
      });
  
      var fargateService = new ecspatterns.ApplicationLoadBalancedFargateService(this, 'PayslipService', {
        serviceName: 'PayslipService',
        cluster: cluster,
        memoryLimitMiB: 2048,
        cpu: 1024,
        desiredCount: 2,
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
        path: "/actuator/health",
        healthyHttpCodes: "200",
        interval: Duration.seconds(120),
        timeout: Duration.seconds(20),
        port: "8080",
      })

      return fargateService.service;
    }

}
