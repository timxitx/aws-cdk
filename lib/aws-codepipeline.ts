import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import { Vpc } from '@aws-cdk/aws-ec2';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import * as codebuild from '@aws-cdk/aws-codebuild';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { GitHubSourceAction, CodeBuildAction, EcsDeployAction} from '@aws-cdk/aws-codepipeline-actions';
import { PipelineProject, LocalCacheMode } from '@aws-cdk/aws-codebuild';
import { FargateService } from '@aws-cdk/aws-ecs';

export class AwsCodepipeline extends cdk.Stack {

    sourceOutput: Artifact = new Artifact();
    buildOutput: Artifact = new Artifact();;
    fargateServices: FargateService[] = [];
    ecrRepository: ecr.Repository;
    vpc: Vpc;
    repoName: string;
    oauthToken: cdk.SecretValue;

  
    constructor(scope: cdk.Construct, id: string, vpc: Vpc, repoName: string, props?: cdk.StackProps) {
      super(scope, id, props);

        this.oauthToken = cdk.SecretValue.secretsManager('github-token');

        this.ecrRepository = new ecr.Repository(this, repoName, {
            repositoryName: repoName
          });

          this.vpc = vpc;
          this.repoName = repoName;

    }



    public addFargateService(Service: FargateService) {
        this.fargateServices.push(Service);
    }

    public build() {
        this.ecrRepository.addLifecycleRule({
            maxImageCount: 1
        })

        var pipelineProject = this.createPipelineProject(this.ecrRepository);
        pipelineProject.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));

        var githubSourceAction = this.createGithubSourceAction(this.sourceOutput, this.oauthToken);
        var buildAction = this.createBuildAction(pipelineProject, this.sourceOutput, this.buildOutput);

        var deployActions = [] as EcsDeployAction[];
        this.fargateServices.forEach((fargateService) => {
            var deployAction = this.createEcsDeployAction(this.vpc, this.ecrRepository, this.buildOutput, pipelineProject, this.repoName, fargateService);
            deployActions.push(deployAction);
        });

        var pipeline = new Pipeline(this, 'my_pipeline_', {
            stages: [
            {
                stageName: 'Source',
                actions: [githubSourceAction]
            },
            {
                stageName: 'Build',
                actions: [buildAction]
            },
              {
                stageName: 'Deploy',
                actions: deployActions
              },
            ],
            pipelineName: "my_pipeline",
    
        });
    }


    private createPipelineProject(ecrRepo: ecr.Repository): codebuild.PipelineProject {
        var pipelineProject = new codebuild.PipelineProject(this, 'my-codepipeline', {
          projectName: "my-codepipeline",
          environment: {
            buildImage: codebuild.LinuxBuildImage.STANDARD_2_0,
            privileged: true
          },
          environmentVariables: {
            "ECR_REPO": {
              value: ecrRepo.repositoryUriForTag()
            }
          },
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
              post_build: {
                commands: [
                  "echo creating imagedefinitions.json dynamically",
                  "printf '[{\"name\":\"" + this.repoName + "\",\"imageUri\": \"" + ecrRepo.repositoryUriForTag() + ":latest\"}]' > imagedefinitions.json",
                  "echo Build completed on `date`"
                ]
              }
            },
            artifacts: {
              files: [
                "imagedefinitions.json"
              ]
            }
          }),
          cache: codebuild.Cache.local(LocalCacheMode.DOCKER_LAYER, LocalCacheMode.CUSTOM)
        });
        return pipelineProject;
      }

      private createGithubSourceAction(sourceOutput: Artifact, oauthToken: any): GitHubSourceAction {
        return new GitHubSourceAction({
          actionName: 'github_source',
          owner: 'timxitx',
          repo: 'monthly-payslip',
          oauthToken: oauthToken,
          output: sourceOutput,
          branch: 'master', // default: 'master'
        });
      }
    
      private createBuildAction(pipelineProject: codebuild.PipelineProject, sourceActionOutput: Artifact,
        buildOutput: Artifact): CodeBuildAction {
        var buildAction = new CodeBuildAction({
          actionName: 'Build',
          project: pipelineProject,
          input: sourceActionOutput,
          outputs: [buildOutput],
    
        });
        return buildAction;
      }
    
      private createEcsDeployAction(vpc: Vpc, ecrRepo: ecr.Repository, buildOutput: Artifact, pipelineProject: PipelineProject, repoName: string, fargateService: FargateService): EcsDeployAction {
        return new EcsDeployAction({
          actionName: 'EcsDeployAction',
          service: fargateService,
          input: buildOutput,
        })
      };
}