# 🐳 Docker Deploy API

[![license](https://badgen.net/docker/pulls/timokoessler/docker-deploy-api)](https://hub.docker.com/r/timokoessler/docker-deploy-api)
[![license](https://badgen.net/github/license/timokoessler/docker-deploy-api)](https://github.com/timokoessler/docker-deploy-api/blob/main/LICENSE)
[![CodeFactor](https://www.codefactor.io/repository/github/timokoessler/docker-deploy-api/badge)](https://www.codefactor.io/repository/github/timokoessler/docker-deploy-api)
[![codecov](https://codecov.io/gh/timokoessler/docker-deploy-api/graph/badge.svg?token=VYS4DJZOP3)](https://codecov.io/gh/timokoessler/docker-deploy-api)

An easy-to-use API for deploying Docker containers to a server.

> [!TIP]
> I recommend new users to use [OrcaCD](https://github.com/OrcaCD/orca-cd/) instead of this project.

Let's say you build a Docker image for your application using a CI/CD pipeline and upload the image to a Docker registry.
But how do you update the running containers on your servers with the new image? You can use Docker Deploy API to do that.

## Features

- Pull new image and recreate container, or only recreate or restart a container
- Update multiple containers at once 🔄️
- Clean up old images 🧹
- Works with private Docker registries 🔒
- No need to give your CI/CD pipeline SSH access to your servers 🛡️
- Works without any database
- Supports any CI/CD pipeline, e.g. GitHub Actions, GitLab CI, etc.

## Installation 🚀

> [!TIP]
> You can find all information about the installation, configuration and usage in the [documentation](https://deploy-api.tkoessler.de).

The easiest way to set up Docker Deploy API is to use the provied [docker-compose](https://github.com/timokoessler/docker-deploy-api/blob/main/docker-compose.yml) file.

## How it works

Docker Deploy API is a HTTP API that you can call from your CI/CD pipeline. The request contains a deploy token that you can generate using the CLI tool.
This token is used to authenticate the request and contains the configuration for the deployment.
For convenience, there is a bash script that you can use in your CI/CD pipeline for sending the request.

## GitHub Actions example

The following example shows how to use Docker Deploy API in a GitHub Actions workflow using the helper bash script that is hosted by every instance of Docker Deploy API.

```yaml
- name: Deploy 🚀
  run: curl -sSL "https://deploy.example.com/s" | bash -s -- "${{ secrets.DEPLOY_TOKEN }}"
```

In the [documentation](https://deploy-api.tkoessler.de) you can find examples for other CI/CD pipelines. You can also start the deployment by simply calling the HTTP API with any tool of your choice.

## Contact

If a public GitHub issue or discussion is not the right choice for your concern, you can contact me directly:

- E-Mail: [info@timokoessler.de](mailto:info@timokoessler.de)

## License

© [Timo Kössler](https://timokoessler.de) 2026  
Released under the [MIT license](https://github.com/timokoessler/docker-deploy-api/blob/main/LICENSE)

<sub><sup>Docker and the Docker logo are trademarks or registered trademarks of Docker, Inc. in the United States and/or other countries. Docker, Inc. and other parties may also have trademark rights in other terms used herein. The whale logo is licensed under the MIT license - © Microsoft Corporation (fluentui-emoji).</sup></sub>
