FROM node:24-slim

ENV NODE_ENV=production
LABEL org.opencontainers.image.authors="Timo Kössler <info@timokoessler.de>"
LABEL org.opencontainers.image.title="Docker Deploy API"
LABEL org.opencontainers.image.description="An easy-to-use API for deploying Docker containers"

RUN echo "#!/bin/sh\nnode cli.js \$@" > /usr/local/bin/cli && \
    chmod +x /usr/local/bin/cli

USER node
WORKDIR /home/node
ENV NODE_ENV=production
ENV IS_DOCKER=true

COPY --chown=node:node ./dist/ ./

CMD ["node", "app"]