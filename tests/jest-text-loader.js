// eslint-disable-next-line unicorn/prefer-module
module.exports = {
    process(sourceText) {
        return {
            code: `module.exports = ${JSON.stringify(sourceText)};`,
        };
    },
};
