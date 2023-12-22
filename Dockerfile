FROM node:20-slim

ENV NODE_ENV production
LABEL org.opencontainers.image.authors="Timo Kössler <info@timokoessler.de>"
LABEL org.opencontainers.image.title="Docker Deploy API"
LABEL org.opencontainers.image.description="An easy-to-use API for deploying Docker containers"

USER node
WORKDIR /home/node

COPY --chown=node:node ./dist/ ./

CMD ["node", "app"]