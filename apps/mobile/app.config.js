const appJson = require("./app.json");

module.exports = () => {
  const expo = structuredClone(appJson.expo);
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (org && project) {
    expo.plugins = [
      ...(expo.plugins || []),
      [
        "@sentry/react-native/expo",
        {
          organization: org,
          project,
        },
      ],
    ];
  }
  return { expo };
};
