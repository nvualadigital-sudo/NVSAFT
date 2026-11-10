// Vercel receives a pre-bundled CommonJS API so it does not type-check the
// entire Replit/Express source tree with Vercel's NodeNext settings.
declare const require: (modulePath: string) => any;

const app = require("../artifacts/api-server/dist-vercel/app.cjs");

export default app;
