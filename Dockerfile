FROM node:26-slim

ENV NODE_ENV=production

RUN echo "#!/bin/sh\nnode cli.js \$@" > /usr/local/bin/cli && \
    chmod +x /usr/local/bin/cli

USER node
WORKDIR /home/node
ENV NODE_ENV=production
ENV IS_DOCKER=true

COPY --chown=node:node ./dist/ ./

CMD ["node", "app"]